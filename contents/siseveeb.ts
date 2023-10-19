import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["https://siseveeb.voco.ee/*"],
    all_frames: true,
}

console.log("Hello Siseveebi kasutaja!")

import './siseveeb/siseveebApi'