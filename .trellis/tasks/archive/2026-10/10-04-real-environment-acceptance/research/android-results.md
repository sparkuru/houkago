# Physical Android observations — 2026-10-04

## Executed boundary

Configuration A device `192.168.9.9:41207`: PLR110 / OP6117L1, Android 16
(SDK 36), physical screen 1272×2800. Via `mark.via.gp` 7.3.3 uses Android
WebView 143.0.7499.34. No usable browser devtools socket was found; observations
use actual ADB touch, keyboard input, UI screenshots and the independent desktop
host's real media/room state. No root action, installation or device-setting
change was performed. Safari is excluded.

Frontend `http://192.168.9.4:15943`, backend port 13943 and Debian media
`http://192.168.9.3:18943` were reachable directly from the device. No ADB reverse,
media interception or simulated WebSocket authority was used. Room:
`/bushitsu/73e06153-d80d-4d95-919d-0cfd8131678b`.

## Observed results

| Operation | Result and evidence |
| --- | --- |
| Native account entry | Registered throwaway `android_b_1004`; declined browser password saving. Login inputs/screens were removed from retained artifacts. |
| Admission and identity | Phone displayed pending approval; independent `physical_host_1004` approved through the actual control dialog. Both clients showed two distinct attendees. |
| Queue/current item | Phone received host-created `Physical LAN clip`, then host-selected `Physical HLS subtitles`. This proves receiving queue/current-item changes; phone-origin queue creation/reordering was not tested. |
| MP4 decoding and follow | Actual test-pattern frame 4.800s, visible progress and pause control after host play. Host pause/seek produced phone 0s/12s and play control. |
| Permitted phone play | Host granted the common-play preset through UI, phone controls became enabled; native phone play tap caused desktop video `time=4.004816`, `paused=false`, `error=null`. |
| Real software keyboard | Chat composer remained visible with the device keyboard open. Native send produced `Android_real_keyboard_1004` in phone and desktop feed, one desktop occurrence. Keyboard dismissed and input cleared. |
| Native fullscreen | Native tap entered landscape fullscreen with decoded frame/time and controls. Device Back restored the normal portrait room. |
| Web fullscreen | Native tap entered page fullscreen with video, danmaku toggle and custom controls. Back restored the room; the later cinema screenshot corroborates normal browser chrome and room content. |
| Cinema | Native toggle produced compact video-first cinema layout; toggle back restored normal room layout. |
| HLS and subtitle | Real HLS video decoded and advanced to 11s. Android native select offered English, and selecting it produced the visible cue `Acceptance English subtitle` in the settled pause/seek screenshot. |
| Echoed danmaku | Desktop UI sent `Android live danmaku 1004`; phone screenshot shows the moving suffix `danmaku 1004` over the decoded HLS frame. No injected overlay or local synthetic echo. |
| Reload recovery | Native toolbar refresh retained identity and the HLS current item, with the 3.000s frame and 3s/12s paused progress. Desktop retained exactly one phone identity and no pending approval. The join-playback gate reappeared as expected for a fresh document; the local subtitle selection returned to off. |

## Evidence and limits

Task-only screenshots are under `/tmp/houkago-acceptance.nJ2AJ79D/artifacts/`:
`android-pending.png`, `android-room.png`, `android-playing.png`,
`android-follow-paused.png`, `android-chat-keyboard.png`, `android-chat-sent.png`,
`desktop-received-android-chat.png`, `android-granted-controls.png`,
`android-native-fullscreen.png`, `android-native-restored.png`,
`android-web-fullscreen.png`, `android-cinema.png`, `android-subtitle-menu.png`,
`android-hls-subtitle-danmaku.png`, `android-hls-paused-seek.png`,
`android-reloaded.png` and `android-restored-final.png`.

Five reviewed task-only screenshots are also retained durably at
`research/evidence/android/`: keyboard, native fullscreen, native restoration,
settled HLS cue/seek and reload. No auth form or private-provider video image is
included there.

Phone screenshots establish visible decoded frames and coarse settled time;
they do not provide precise dynamic drift samples. The desktop <=2s sampling
result must not be described as a measured phone drift distribution. DASH,
mobile Baidu, phone-origin queue edits, WAN loss and Safari were not executed.
The replay/reconnect observation is browser refresh, not a network outage.

Native input needed correction when the keyboard moved the registration form;
a clean attempt using Tab fixed the input target. A few desktop diagnostic
selectors also timed out (wrong button names or an already-ended clip). The
final observations above come from actual rendered state and corrected actions,
not from those failed diagnostic calls.

Core preview/browser and remote fixture server have been stopped after these
observations. Device tabs remain pending cleanup while live-provider acceptance
is active. Do not clear unrelated browser data or close unowned tabs.
