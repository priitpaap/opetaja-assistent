import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["https://tahvel.edu.ee/*"],
    all_frames: true,
}

console.log("Hello Tahvli kasutaja!")

import './tahvel/tahvelApi'
