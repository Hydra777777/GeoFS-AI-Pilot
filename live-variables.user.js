// ==UserScript==
// @name        GeoFS Live Variable Display
// @namespace   http://tampermonkey.net/
// @version     0.1
// @description Displays live GeoFS aircraft and control variables.
// @author      Hydra
// @match       https://www.geo-fs.com/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

(function () {
	"use strict";

	// Inject Tailwind CSS for styling
	const tailwindScript = document.createElement("script");
	tailwindScript.src = "https://cdn.tailwindcss.com";
	document.head.appendChild(tailwindScript);

	// Create the main display element and its content
	const variablesDisplay = document.createElement("div");
	variablesDisplay.id = "variables-display";
	variablesDisplay.innerHTML = `
        <div class="bg-slate-800 bg-opacity-80 text-white p-2 rounded-lg shadow-lg max-w-xs font-mono overflow-y-auto">
            <h1 class="text-base font-bold mb-1 text-center text-sky-400">GeoFS AI Pilot Data</h1>
            <p id="status-message" class="text-center text-xs italic">Waiting for GeoFS to load...</p>

            <div id="data-container" class="hidden">
                <div id="position-data" class="mb-2">
                    <h2 class="text-sm font-semibold mb-1 text-sky-200">Position & Orientation</h2>
                    <p class="text-xs">Latitude: <span id="lat">N/A</span></p>
                    <p class="text-xs">Longitude: <span id="lon">N/A</span></p>
                    <p class="text-xs">Altitude (ft): <span id="altitude">N/A</span></p>
                    <p class="text-xs">Heading (deg): <span id="heading">N/A</span></p>
                    <p class="text-xs">Pitch (deg): <span id="pitch">N/A</span></p>
                    <p class="text-xs">Roll (deg): <span id="roll">N/A</span></p>
                </div>

                <div id="speed-data" class="mb-2">
                    <h2 class="text-sm font-semibold mb-1 text-sky-200">Speed</h2>
                    <p class="text-xs">Ground Speed (kts): <span id="groundSpeed">N/A</span></p>
                    <p class="text-xs">Airspeed (kts): <span id="airspeed">N/A</span></p>
                    <p class="text-xs">Vertical Speed (ft/min): <span id="vspeed">N/A</span></p>
                </div>

                <div id="controls-data" class="mb-2">
                    <h2 class="text-sm font-semibold mb-1 text-sky-200">Controls</h2>
                    <p class="text-xs">Throttle: <span id="throttle">N/A</span></p>
                    <p class="text-xs">Pitch: <span id="pitchCtrl">N/A</span></p>
                    <p class="text-xs">Roll: <span id="rollCtrl">N/A</span></p>
                    <p class="text-xs">Yaw: <span id="yawCtrl">N/A</span></p>
                    <p class="text-xs">Gear: <span id="gear">N/A</span></p>
                    <p class="text-xs">Brakes: <span id="brakes">N/A</span></p>
                    <p class="text-xs">Flaps: <span id="flaps">N/A</span></p>
                </div>

                <div id="engine-data" class="mb-2">
                    <h2 class="text-sm font-semibold mb-1 text-sky-200">Aircraft Info</h2>
                    <p class="text-xs">Aircraft: <span id="aircraftName">N/A</span></p>
                    <p class="text-xs">Mass (kg): <span id="mass">N/A</span></p>
                    <p class="text-xs">Engines: <span id="engines">N/A</span></p>
                </div>

                <div id="environment-data" class="mb-2">
                    <h2 class="text-sm font-semibold mb-1 text-sky-200">Environment</h2>
                    <p class="text-xs">Wind Speed (kts): <span id="windSpeed">N/A</span></p>
                    <p class="text-xs">Wind Direction (deg): <span id="windDirection">N/A</span></p>
                </div>

                <div id="runway-data">
                    <h2 class="text-sm font-semibold mb-1 text-sky-200">Runway Info</h2>
                    <p class="text-xs">Nearest Runway: <span id="nearestRunway">N/A</span></p>
                </div>
            </div>
        </div>
    `;

	// Add styles for the overlay
	const style = document.createElement("style");
	style.innerHTML = `
        #variables-display {
            position: fixed;
            top: 20px;
            bottom: 20px;
            left: 20px;
            right: auto;
            z-index: 1000;
            width: 90vw;
            max-width: 300px;
        }

        #variables-display > div {
            height: 100%;
            overflow-y: auto;
        }
    `;

	document.body.appendChild(variablesDisplay);
	document.body.appendChild(style);

	document.body.appendChild(variablesDisplay);
	document.body.appendChild(style);

	// Utility function to safely get a nested property, preventing errors.
	function getNested(obj, ...path) {
		return path.reduce((o, p) => o && o[p], obj);
	}

	// Get references to all the HTML elements for displaying data
	const elements = {
		lat: document.getElementById("lat"),
		lon: document.getElementById("lon"),
		altitude: document.getElementById("altitude"),
		heading: document.getElementById("heading"),
		pitch: document.getElementById("pitch"),
		roll: document.getElementById("roll"),
		groundSpeed: document.getElementById("groundSpeed"),
		airspeed: document.getElementById("airspeed"),
		vspeed: document.getElementById("vspeed"),
		throttle: document.getElementById("throttle"),
		pitchCtrl: document.getElementById("pitchCtrl"),
		rollCtrl: document.getElementById("rollCtrl"),
		yawCtrl: document.getElementById("yawCtrl"),
		gear: document.getElementById("gear"),
		brakes: document.getElementById("brakes"),
		flaps: document.getElementById("flaps"),
		aircraftName: document.getElementById("aircraftName"),
		mass: document.getElementById("mass"),
		engines: document.getElementById("engines"),
		windSpeed: document.getElementById("windSpeed"),
		windDirection: document.getElementById("windDirection"),
		nearestRunway: document.getElementById("nearestRunway"),
	};

	// The main function to update the variables
	function updateVariables() {
		// Check if GeoFS is loaded
		if (
			typeof geofs === "undefined" ||
			!geofs.aircraft ||
			!geofs.aircraft.instance
		) {
			document.getElementById("data-container").classList.add("hidden");
			document.getElementById("status-message").classList.remove("hidden");
			return;
		}

		document.getElementById("status-message").classList.add("hidden");
		document.getElementById("data-container").classList.remove("hidden");

		const aircraft = geofs.aircraft.instance;
		const animation = geofs.animation.values;

		// Position & Orientation - Fixed lat/lon access
		elements.lat.textContent = aircraft.llaLocation
			? aircraft.llaLocation[0].toFixed(4)
			: "N/A";
		elements.lon.textContent = aircraft.llaLocation
			? aircraft.llaLocation[1].toFixed(4)
			: "N/A";
		elements.altitude.textContent = animation.altitude
			? animation.altitude.toFixed(2)
			: "N/A";
		elements.heading.textContent = animation.heading
			? animation.heading.toFixed(2)
			: "N/A";
		elements.pitch.textContent = animation.atilt
			? animation.atilt.toFixed(2)
			: "N/A";
		elements.roll.textContent = animation.aroll
			? animation.aroll.toFixed(2)
			: "N/A";

		// Speed (reverted to working version)
		elements.groundSpeed.textContent = animation.groundSpeed
			? animation.groundSpeed.toFixed(2)
			: "N/A";
		elements.airspeed.textContent = animation.kias
			? animation.kias.toFixed(2)
			: "N/A";
		elements.vspeed.textContent = animation.verticalSpeed
			? animation.verticalSpeed.toFixed(2)
			: "N/A";

		// Controls
		elements.throttle.textContent = controls.throttle
			? controls.throttle.toFixed(2)
			: "N/A";
		elements.pitchCtrl.textContent = controls.pitch
			? controls.pitch.toFixed(2)
			: "N/A";
		elements.rollCtrl.textContent = controls.roll
			? controls.roll.toFixed(2)
			: "N/A";
		elements.yawCtrl.textContent = controls.yaw
			? controls.yaw.toFixed(2)
			: "N/A";

		// Raw gear data
		const gearData = {
			gearPosition: aircraft.gearPosition,
			animationGear: animation.gear,
			controlsGear: controls.gear,
			gearTarget: aircraft.gearTarget,
		};
		elements.gear.textContent = `Raw: ${JSON.stringify(gearData)}`;

		elements.brakes.textContent = controls.brakes
			? controls.brakes.toFixed(2)
			: "N/A";

		const flapsData = {
			flapsValue: aircraft.flapsValue,
			animationFlaps: animation.flaps,
			controlsFlaps: controls.flaps,
			flapsTarget: aircraft.flapsTarget,
			maxFlaps: aircraft.definition.maxFlaps || 1,
		};
		elements.flaps.textContent = `${flapsData.controlsFlaps.position} / ${flapsData.controlsFlaps.maxPosition}`;

		// Aircraft Info
		elements.aircraftName.textContent = aircraft.definition.name || "N/A";
		elements.mass.textContent = aircraft.definition.mass
			? aircraft.definition.mass.toFixed(2)
			: "N/A";

		// Engines
		if (aircraft.engines && aircraft.engines.length > 0) {
			const engineValues = aircraft.engines
				.map((engine, index) => {
					if (engine.rpm !== undefined) {
						return `E${index + 1}: ${engine.rpm.toFixed(0)} RPM`;
					} else if (engine.thrust !== undefined) {
						return `E${index + 1}: ${(engine.thrust / 1000).toFixed(1)}k N`;
					}
					return `E${index + 1}: N/A`;
				})
				.join(" | ");
			elements.engines.textContent = engineValues;
		} else {
			elements.engines.textContent = "N/A";
		}

		// Environment
		elements.windSpeed.textContent = geofs.wind
			? geofs.wind.speed.toFixed(2)
			: "N/A";
		elements.windDirection.textContent = geofs.wind
			? geofs.wind.direction.toFixed(2)
			: "N/A";

		// Runway Information
		try {
			const nearestRunway = geofs.runways.getNearestRunway(
				aircraft.llaLocation
			);
			if (nearestRunway) {
				const distance = geofs.utils.distanceBetweenLocations(
					aircraft.llaLocation,
					nearestRunway.aimingPointLla1
				);
				const testDist = geofs.utils.distanceBetweenLocations(
					aircraft.llaLocation,
					nearestRunway.aimingPointLla2
				);
				const finalDist = Math.min(distance, testDist);
				elements.nearestRunway.textContent = `${
					nearestRunway.name
				} (${finalDist.toFixed(1)}nm)`;
			} else {
				elements.nearestRunway.textContent = "No runway found";
			}
		} catch (error) {
			console.log("Runway detection error:", error);
			elements.nearestRunway.textContent = "Error getting runway";
		}
	}

	// Start a continuous update loop that runs every 50ms
	setInterval(updateVariables, 50);
})();
