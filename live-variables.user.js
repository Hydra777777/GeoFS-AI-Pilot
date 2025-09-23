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

(function() {
    'use strict';

    // Inject Tailwind CSS for styling
    const tailwindScript = document.createElement('script');
    tailwindScript.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(tailwindScript);

    // Create the main display element and its content
    const variablesDisplay = document.createElement('div');
    variablesDisplay.id = "variables-display";
    variablesDisplay.innerHTML = `
        <div class="bg-slate-800 bg-opacity-80 text-white p-4 rounded-lg shadow-lg max-w-sm font-mono">
            <h1 class="text-xl font-bold mb-2 text-center text-sky-400">GeoFS AI Pilot Data</h1>
            <p id="status-message" class="text-center text-sm italic">Waiting for GeoFS to load...</p>

            <div id="data-container" class="hidden">
                <div id="position-data" class="mb-4">
                    <h2 class="text-lg font-semibold mb-1 text-sky-200">Position & Orientation</h2>
                    <p class="text-sm">Latitude: <span id="lat">N/A</span></p>
                    <p class="text-sm">Longitude: <span id="lon">N/A</span></p>
                    <p class="text-sm">Altitude (ft): <span id="altitude">N/A</span></p>
                    <p class="text-sm">Heading (deg): <span id="heading">N/A</span></p>
                    <p class="text-sm">Pitch (deg): <span id="pitch">N/A</span></p>
                    <p class="text-sm">Roll (deg): <span id="roll">N/A</span></p>
                </div>

                <div id="speed-data" class="mb-4">
                    <h2 class="text-lg font-semibold mb-1 text-sky-200">Speed</h2>
                    <p class="text-sm">Ground Speed (kts): <span id="groundSpeed">N/A</span></p>
                    <p class="text-sm">Airspeed (kts): <span id="airspeed">N/A</span></p>
                    <p class="text-sm">Vertical Speed (ft/min): <span id="vspeed">N/A</span></p>
                </div>

                <div id="controls-data" class="mb-4">
                    <h2 class="text-lg font-semibold mb-1 text-sky-200">Controls</h2>
                    <p class="text-sm">Throttle: <span id="throttle">N/A</span></p>
                    <p class="text-sm">Pitch: <span id="pitchCtrl">N/A</span></p>
                    <p class="text-sm">Roll: <span id="rollCtrl">N/A</span></p>
                    <p class="text-sm">Yaw: <span id="yawCtrl">N/A</span></p>
                    <p class="text-sm">Gear: <span id="gear">N/A</span></p>
                    <p class="text-sm">Brakes: <span id="brakes">N/A</span></p>
                    <p class="text-sm">Flaps: <span id="flaps">N/A</span></p>
                </div>

                <div id="engine-data" class="mb-4">
                    <h2 class="text-lg font-semibold mb-1 text-sky-200">Aircraft Info</h2>
                    <p class="text-sm">Aircraft: <span id="aircraftName">N/A</span></p>
                    <p class="text-sm">Mass (kg): <span id="mass">N/A</span></p>
                    <p class="text-sm">Engines: <span id="engines">N/A</span></p>
                </div>

                <div id="environment-data">
                    <h2 class="text-lg font-semibold mb-1 text-sky-200">Environment</h2>
                    <p class="text-sm">Wind Speed (kts): <span id="windSpeed">N/A</span></p>
                    <p class="text-sm">Wind Direction (deg): <span id="windDirection">N/A</span></p>
                </div>
            </div>
        </div>
    `;

    // Add styles for the overlay
    const style = document.createElement('style');
    style.innerHTML = `
        #variables-display {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        }
    `;

    document.body.appendChild(variablesDisplay);
    document.body.appendChild(style);

    // Utility function to safely get a nested property, preventing errors.
    function getNested(obj, ...path) {
        return path.reduce((o, p) => (o && o[p]), obj);
    }

    // Get references to all the HTML elements for displaying data
    const elements = {
        lat: document.getElementById('lat'),
        lon: document.getElementById('lon'),
        altitude: document.getElementById('altitude'),
        heading: document.getElementById('heading'),
        pitch: document.getElementById('pitch'),
        roll: document.getElementById('roll'),
        groundSpeed: document.getElementById('groundSpeed'),
        airspeed: document.getElementById('airspeed'),
        vspeed: document.getElementById('vspeed'),
        throttle: document.getElementById('throttle'),
        pitchCtrl: document.getElementById('pitchCtrl'),
        rollCtrl: document.getElementById('rollCtrl'),
        yawCtrl: document.getElementById('yawCtrl'),
        gear: document.getElementById('gear'),
        brakes: document.getElementById('brakes'),
        flaps: document.getElementById('flaps'),
        aircraftName: document.getElementById('aircraftName'),
        mass: document.getElementById('mass'),
        engines: document.getElementById('engines'),
        windSpeed: document.getElementById('windSpeed'),
        windDirection: document.getElementById('windDirection')
    };

    // The main function to update the variables
    function updateVariables() {
        // Only check for the main geofs object and the essential aircraft instance before proceeding.
        if (typeof geofs === "undefined" || !geofs.aircraft || !geofs.aircraft.instance) {
            document.getElementById('data-container').classList.add('hidden');
            document.getElementById('status-message').classList.remove('hidden');
            return;
        }

        // geofs object is found, now we can show the container and proceed.
        document.getElementById('status-message').classList.add('hidden');
        document.getElementById('data-container').classList.remove('hidden');

        const instance = getNested(geofs, 'aircraft', 'instance');
        const controls = getNested(geofs, 'api', 'get') ? geofs.api.get('controls') : null;
        const animation = getNested(geofs, 'animation', 'values');
        const wind = getNested(geofs, 'wind');

        // Position & Orientation
        if (getNested(instance, 'latlng') && Array.isArray(instance.latlng) && instance.latlng.length === 2) {
            elements.lat.textContent = instance.latlng[0]?.toFixed(4);
            elements.lon.textContent = instance.latlng[1]?.toFixed(4);
        } else {
            elements.lat.textContent = 'N/A';
            elements.lon.textContent = 'N/A';
        }
        elements.altitude.textContent = getNested(animation, 'altitude')?.toFixed(2) || 'N/A';
        elements.heading.textContent = getNested(instance, 'heading360')?.toFixed(2) || 'N/A';

        // Use the more reliable geofs.animation.values for pitch and roll
        elements.pitch.textContent = getNested(animation, 'pitch')?.toFixed(2) || 'N/A';
        elements.roll.textContent = getNested(animation, 'roll')?.toFixed(2) || 'N/A';

        // Speed
        elements.groundSpeed.textContent = getNested(instance, 'groundSpeed')?.toFixed(2) || 'N/A';
        elements.airspeed.textContent = getNested(instance, 'airspeed')?.toFixed(2) || 'N/A';
        elements.vspeed.textContent = getNested(animation, 'verticalSpeed')?.toFixed(2) || 'N/A';

        // Controls
        elements.throttle.textContent = getNested(controls, 'throttle')?.toFixed(2) || 'N/A';
        elements.pitchCtrl.textContent = getNested(controls, 'pitch')?.toFixed(2) || 'N/A';
        elements.rollCtrl.textContent = getNested(controls, 'roll')?.toFixed(2) || 'N/A';
        elements.yawCtrl.textContent = getNested(controls, 'yaw')?.toFixed(2) || 'N/A';
        elements.gear.textContent = (getNested(controls, 'gear') == 1 ? 'DOWN' : 'UP') || 'N/A';
        elements.brakes.textContent = getNested(controls, 'brakes')?.toFixed(2) || 'N/A';
        elements.flaps.textContent = getNested(controls, 'flaps')?.toFixed(2) || 'N/A';

        // Aircraft Info
        elements.aircraftName.textContent = getNested(instance, 'definition', 'name') || 'N/A';
        elements.mass.textContent = getNested(instance, 'definition', 'mass')?.toFixed(2) || 'N/A';

        // Engines - Check multiple possible locations for engine data
        const engines = getNested(instance, 'engines') || getNested(instance, 'definition', 'propulsion');
        if (engines && Array.isArray(engines)) {
            const values = engines.map(e => (e.rpm !== undefined ? `RPM: ${e.rpm.toFixed(0)}` : (e.thrust !== undefined ? `Thrust: ${e.thrust.toFixed(0)}` : 'N/A'))).join(', ');
            elements.engines.textContent = values;
        } else {
            elements.engines.textContent = 'N/A';
        }

        // Environment
        elements.windSpeed.textContent = getNested(wind, 'speed')?.toFixed(2) || 'N/A';
        elements.windDirection.textContent = getNested(wind, 'direction')?.toFixed(2) || 'N/A';
    }

    // Start a continuous update loop that runs every 50ms
    setInterval(updateVariables, 50);

})();
