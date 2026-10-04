import { useId } from "react"

export function ClassroomScene() {
  const light = useId()
  const screen = useId()
  return (
    <svg className="classroom-scene" viewBox="0 0 640 340" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={light}
          x1="139"
          y1="120"
          x2="393"
          y2="307"
          gradientUnits="userSpaceOnUse"
        >
          <stop className="scene-light-source" />
          <stop className="scene-light-fade" offset="1" />
        </linearGradient>
        <linearGradient
          id={screen}
          x1="358"
          y1="75"
          x2="358"
          y2="209"
          gradientUnits="userSpaceOnUse"
        >
          <stop className="scene-screen-source" />
          <stop className="scene-screen-shade" offset="1" />
        </linearGradient>
      </defs>
      <path className="scene-wall" d="M62 45h516v244H62Z" />
      <path className="scene-floor" d="M62 245h516l45 62H17Z" />
      <path className="scene-light" fill={`url(#${light})`} d="M97 85h84l313 220H243L97 154Z" />
      <g className="scene-lines" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M17 307h606M62 245h516M62 45v200l-45 62M578 45v200l45 62M62 45h516" />
        <path
          className="scene-faint"
          d="m170 245-38 62m140-62-12 62m112-62 14 62m92-62 42 62M40 276h560"
        />
        <path d="M86 76h105v121H86Z" />
        <path className="scene-window" d="M93 83h91v107H93Z" />
        <path d="M139 83v107m-46-53h91M83 201h112" />
        <path className="scene-screen" fill={`url(#${screen})`} d="M235 75h246v134H235Z" />
        <path d="M232 69h252m-126 0v-9m-126 153h252M355 213v7" />
        <path className="scene-play" d="m344 127 27 16-27 16Z" />
        <path d="M510 110h42v135h-42Zm-7-5h55v140m-14-67v13" />
        <path className="scene-seat" d="M234 224h67v20h-67Zm131 0h67v20h-67Z" />
        <path d="M232 244h71m-62 0-6 32m59-32 6 32M363 244h71m-62 0-6 32m59-32 6 32" />
        <path className="scene-seat" d="M232 277h75v-5h-75Zm133 0h75v-5h-75Z" />
        <path d="m240 277-4 17m64-17 4 17m68-17-4 17m64-17 4 17" />
        <path className="scene-faint" d="M91 52v10m-5-5h10m473 0h4" />
      </g>
    </svg>
  )
}
