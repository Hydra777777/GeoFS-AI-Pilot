// ==UserScript==
// @name        GeoFS AI Pilot
// @namespace   http://tampermonkey.net/
// @version     0.1
// @description AI fly plane
// @author      Hydra + Lots of AI Models
// @match       https://www.geo-fs.com/geofs.php?v=3.9*
// @grant       none
// @run-at      document-idle
// @require     https://cdn.tailwindcss.com
// @require     https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
// ==/UserScript==

(function () {
	"use strict";

	function waitForGeoFS() {
		if (typeof geofs === "undefined") {
			setTimeout(waitForGeoFS, 100);
			return;
		}
		initialize();
	}
	waitForGeoFS();

	function initialize() {
		// UI Elements
		const uiContainer = document.createElement("div");
		uiContainer.id = "ai-pilot-ui-container";
		uiContainer.style = "position: fixed; top: 4px; right: 4px; z-index: 1002;";
		const ui = document.createElement("div");
		ui.id = "ai-pilot-ui";
		ui.innerHTML = `
            <div class="bg-slate-800 bg-opacity-80 text-white p-2 rounded-lg shadow-lg max-w-xs font-mono">
                <h1 class="text-base font-bold mb-1 text-center text-sky-400">AI Pilot</h1>
                <p id="status" class="text-center text-xs italic">Idle</p>
                <div id="prompt-container" class="mt-2" contenteditable="true" placeholder="Enter command (e.g., take off)"
                    style="outline: none; border: 1px solid #4B5563; padding: 4px; min-height: 20px; background: white; color: black;"></div>
                <button id="submit-prompt" class="w-full mt-2 bg-sky-500 hover:bg-sky-700 text-white p-1 rounded">Submit</button>
                <button id="toggle-ai" class="w-full mt-2 bg-gray-500 hover:bg-gray-700 text-white p-1 rounded">Toggle AI (Ctrl+A)</button>
                <div id="key-setup" class="hidden mt-2">
                    <input id="api-key-input" type="text" class="w-full p-1 text-black rounded" placeholder="Enter Hugging Face API Key">
                    <button id="save-key" class="w-full mt-2 bg-green-500 hover:bg-green-700 text-white p-1 rounded">Save Key</button>
                </div>
            </div>
        `;
		uiContainer.appendChild(ui);
		document.body.appendChild(uiContainer);

		const style = document.createElement("style");
		style.innerHTML = `
            #ai-pilot-ui { z-index: 1002; }
            #prompt-container:focus { outline: 2px solid #4B5563; }
            [contenteditable]:empty::before {
                content: attr(placeholder);
                pointer-events: none;
                display: block;
                color: #A0AEC0;
            }
        `;
		document.head.appendChild(style);

		// State Management
		let isActive = false;
		let currentMode = "idle";
		let cachedResponse = null;

		// Key Management
		const KEY_STORAGE = "geofsAiApiKey";
		const SALT = "geoFsSalt2025";

		function encryptKey(key) {
			return CryptoJS.AES.encrypt(key, SALT).toString();
		}

		function decryptKey(encrypted) {
			try {
				const bytes = CryptoJS.AES.decrypt(encrypted, SALT);
				return bytes.toString(CryptoJS.enc.Utf8);
			} catch (e) {
				console.error("Decryption failed:", e);
				return null;
			}
		}

		function setupKey() {
			const storedKey = localStorage.getItem(KEY_STORAGE);
			if (!storedKey || decryptKey(storedKey) === "") {
				document.getElementById("key-setup").classList.remove("hidden");
				document.getElementById("save-key").onclick = () => {
					const key = document.getElementById("api-key-input").value;
					if (key) {
						localStorage.setItem(KEY_STORAGE, encryptKey(key));
						document.getElementById("key-setup").classList.add("hidden");
					}
				};
			}
		}
		setupKey();

		// API Call
		async function callHuggingFace(prompt, context) {
			try {
				const apiKey = decryptKey(localStorage.getItem(KEY_STORAGE));
				if (!apiKey) throw new Error("API key not set");

				const url =
					"https://api-inference.huggingface.co/models/distilbert-base-uncased";
				const response = await fetch(url, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						inputs: `${prompt} [Context: ${context}]`,
						options: { wait_for_model: true },
					}),
				});

				if (!response.ok)
					throw new Error(`HTTP error! status: ${response.status}`);
				const result = await response.json();
				cachedResponse =
					result[0]?.generated_text ||
					result[0]?.sequence ||
					"No valid response";
				console.log("API Response:", cachedResponse);
				return cachedResponse;
			} catch (error) {
				console.error("API Error:", error.message);
				cachedResponse = "Error: Check console";
				return null;
			}
		}

		// Utility
		function findNearestAirport(lat, lon) {
			let minDist = Infinity;
			let nearest = null;
			for (let icao in geofs.mainAirportList) {
				const [airportLat, airportLon] = geofs.mainAirportList[icao];
				const dist = Math.sqrt(
					(lat - airportLat) ** 2 + (lon - airportLon) ** 2
				);
				if (dist < minDist) {
					minDist = dist;
					nearest = icao;
				}
			}
			return nearest;
		}

		function findNearestRunway(lat, lon) {
			let minDist = Infinity;
			let nearest = null;
			for (let latGrid in geofs.majorRunwayGrid) {
				for (let lonGrid in geofs.majorRunwayGrid[latGrid]) {
					geofs.majorRunwayGrid[latGrid][lonGrid].forEach((runway) => {
						const [, , , , runwayLat, runwayLon] = runway;
						const dist = Math.sqrt(
							(lat - runwayLat) ** 2 + (lon - runwayLon) ** 2
						);
						if (dist < minDist) {
							minDist = dist;
							nearest = { icao: runway[0], lat: runwayLat, lon: runwayLon };
						}
					});
				}
			}
			return nearest;
		}

		// Update Loop
		function update() {
			if (
				!isActive ||
				typeof geofs === "undefined" ||
				!geofs.aircraft ||
				!geofs.aircraft.instance
			) {
				document.getElementById("status").textContent = "Waiting for GeoFS...";
				setTimeout(update, 50);
				return;
			}

			const aircraft = geofs.aircraft.instance;
			const animation = geofs.animation.values;
			const gForce = animation.accZ / 9.80665 || 0;
			const agl = (animation.altitude || 0) - (geofs.groundElevation || 0);
			const [lat, lon] = aircraft.llaLocation || [0, 0];
			const nearestAirport = findNearestAirport(lat, lon);
			const nearestRunway = findNearestRunway(lat, lon);

			document.getElementById(
				"status"
			).textContent = `${currentMode} (G: ${gForce.toFixed(
				1
			)}g, AGL: ${agl.toFixed(1)}ft, Nearest: ${nearestAirport || "N/A"})`;

			if (currentMode !== "idle" && cachedResponse) {
				if (gForce > 8.5 && controls && controls.throttle)
					controls.throttle = Math.max(0, controls.throttle - 0.1);
				else if (
					currentMode === "takeoff" &&
					agl > 50 &&
					controls &&
					controls.pitch
				)
					controls.pitch = 0.3;
				else if (
					currentMode === "land" &&
					agl < 100 &&
					nearestRunway &&
					controls
				) {
					controls.throttle = 0.2;
					controls.pitch = -0.1;
				}
			}

			setTimeout(update, 50);
		}
		update();

		// Event Handlers
		document.getElementById("submit-prompt").onclick = () => {
			const promptContainer = document.getElementById("prompt-container");
			const prompt = promptContainer.textContent.trim();
			if (prompt) {
				currentMode = "executing";
				const aircraft = geofs.aircraft.instance;
				const animation = geofs.animation.values;
				const [lat, lon] = aircraft.llaLocation || [0, 0];
				const agl = (animation.altitude || 0) - (geofs.groundElevation || 0);
				const nearestAirport = findNearestAirport(lat, lon);
				const nearestRunway = findNearestRunway(lat, lon);
				const context = `Aircraft: ${
					aircraft.aircraftRecord.name || "Unknown"
				}, Lat: ${lat}, Lon: ${lon}, AGL: ${agl.toFixed(1)}ft, Speed: ${
					animation.kias || 0
				}kts, Nearest Airport: ${nearestAirport || "N/A"}, Nearest Runway: ${
					nearestRunway ? nearestRunway.icao : "N/A"
				}`;

				callHuggingFace(prompt, context).then((response) => {
					if (response) {
						cachedResponse = response;
						if (response.toLowerCase().includes("take off")) {
							currentMode = "takeoff";
							if (controls && controls.throttle) controls.throttle = 1.0;
						} else if (response.toLowerCase().includes("land")) {
							currentMode = "land";
						}
					}
				});
				promptContainer.textContent = "";
			}
		};

		document.getElementById("toggle-ai").onclick = () => {
			isActive = !isActive;
			document.getElementById("toggle-ai").textContent = `Toggle AI (Ctrl+A) [${
				isActive ? "On" : "Off"
			}]`;
		};

		// Prevent GeoFS keybinds when typing in the prompt
		const promptContainer = document.getElementById("prompt-container");
		promptContainer.addEventListener(
			"keydown",
			(e) => {
				if (promptContainer === document.activeElement) {
					// Always block GeoFS from receiving keystrokes while focused
					e.stopImmediatePropagation();
					// But only preventDefault for non-editing keys so typing works
					if (
						!(
							e.key.length === 1 ||
							e.key === "Backspace" ||
							e.key === "Delete" ||
							e.key === "Enter" ||
							e.key.startsWith("Arrow")
						)
					) {
						e.preventDefault();
					}
				}
			},
			{ capture: true }
		);

		document.addEventListener(
			"keydown",
			(e) => {
				const isInputFocused = promptContainer === document.activeElement;
				if (e.ctrlKey && e.key === "a" && !isInputFocused) {
					isActive = !isActive;
					document.getElementById(
						"toggle-ai"
					).textContent = `Toggle AI (Ctrl+A) [${isActive ? "On" : "Off"}]`;
					e.preventDefault();
				}
			},
			{ capture: true }
		);
	}
})();
