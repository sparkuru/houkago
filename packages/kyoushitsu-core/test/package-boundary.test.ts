import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import manifest from "../package.json"

const packageRoot = fileURLToPath(new URL("../", import.meta.url))
const sourceRoot = resolve(packageRoot, "src")
const portableDependencies = new Set(["houkago-kousoku", "houkago-kokuban", "@sinclair/typebox"])

function moduleSpecifiers(source: string): string[] {
  const result: string[] = []
  const file = ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest, true)
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier.text)
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      result.push(node.argument.literal.text)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const argument = node.moduleReference.expression
      if (!argument || !ts.isStringLiteral(argument)) {
        throw new Error("Core imports must name a statically checkable module")
      }
      result.push(argument.text)
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0]
      if (!argument || !ts.isStringLiteral(argument)) {
        throw new Error("Core runtime imports must name a statically checkable module")
      }
      result.push(argument.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return result
}

function assertPortableImport(file: string, specifier: string): void {
  if (specifier.startsWith(".")) {
    const target = resolve(dirname(file), specifier)
    const localPath = relative(sourceRoot, target)
    if (localPath.startsWith("..")) throw new Error(`Core import escapes src: ${specifier}`)
    if (![target, `${target}.ts`, resolve(target, "index.ts")].some(existsSync)) {
      throw new Error(`Core import cannot resolve: ${specifier}`)
    }
    return
  }
  const dependency = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0]
  if (!dependency || !portableDependencies.has(dependency)) {
    throw new Error(`Core imports an application/framework dependency: ${specifier}`)
  }
}

test("core exports and runtime imports stay inside its portable package boundary", async () => {
  expect(Object.keys(manifest.dependencies).sort()).toEqual([...portableDependencies].sort())
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    expect(subpath).toStartWith("./")
    expect(subpath).not.toContain("*")
    expect(target).toStartWith("./src/")
    expect(existsSync(resolve(packageRoot, target))).toBe(true)
  }
  for await (const path of new Bun.Glob("**/*.ts").scan(sourceRoot)) {
    const file = resolve(sourceRoot, path)
    for (const specifier of moduleSpecifiers(await Bun.file(file).text())) {
      assertPortableImport(file, specifier)
    }
  }
})

test("boundary inspection includes reexports, type and runtime imports and source escapes", () => {
  const file = resolve(sourceRoot, "room/example.ts")
  const specifiers = moduleSpecifiers(`
    export { ref } from "vue"
    import type { App } from "houkago-housou"
    type Store = typeof import("pinia")
    const view = import("react")
    import framework = require("vue")
    const store = require("pinia")
    import "../../../outside-ui/main"
  `)
  expect(specifiers).toHaveLength(7)
  for (const specifier of specifiers) {
    expect(() => assertPortableImport(file, specifier)).toThrow()
  }
  expect(() => moduleSpecifiers("import(moduleName)")).toThrow()
  expect(() => moduleSpecifiers("require(moduleName)")).toThrow()
  expect(() => assertPortableImport(file, "houkago-kyoushitsu/room-session")).toThrow()
  expect(() => assertPortableImport(file, "@/components/player")).toThrow()
})
