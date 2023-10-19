import type { PlasmoCSConfig } from "plasmo"
import * as fs from 'fs';


export const config: PlasmoCSConfig = {
    matches: ["https://tahvel.edu.ee/*"],
    all_frames: true,
}

console.log("Hello Tahvli kasutaja!")

import './tahvel/tahvelApi'
// Handles API requests for School A

// async function fetchData() {
//     try {
//         const response = await fetch(apiUrl);
//         const data = await response.json();
//         return data;
//     } catch (error) {
//         console.error('Error fetching data:', error);
//     }
// }
