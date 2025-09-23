// ==UserScript==
// @name         GeoFS Live Variables Monitor
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Standalone addon to display live GeoFS flight variables for AI pilot development.
// @author       YourName
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Inject CSS for tabs and overlay
    const style = document.createElement('style');
    style.textContent = `
        #geofs-vars-overlay {
            position: fixed; bottom: 10px; left: 10px; background: rgba(0, 0, 0, 0.8);
            color: white; padding: 15px; border-radius: 8px; z-index: 9999;
            font-family: monospace; max-width: 350px; max-height: 80vh; overflow-y: auto;
        }
        #geofs-vars-overlay h3 { margin: 0 0 10px; font-size: 16px; }
        #geofs-vars-overlay button { margin: 5px; padding: 5px 10px; cursor: pointer; }
        .tab { display: none; }
        .tab.active { display: block; }
        .tab-buttons button.active { background: #555; }
    `;
    document.head.appendChild(style);

    // Create overlay with tabs
    const overlay = document.createElement('div');
    overlay.id = 'geofs-vars-overlay';
    overlay.innerHTML = `
        <h3>GeoFS Variables Monitor</h3>
        <button id="toggle-overlay">Hide</button>
        <div class="tab-buttons">
            <button class="tab-btn active" data-tab="position">Position</button>
            <button class="tab-btn" data-tab="orientation">Orientation</button>
            <button class="tab-btn" data-tab="speed">Speed</button>
            <button class="tab-btn" data-tab="controls">Controls</button>
            <button class="tab-btn" data-tab="aircraft">Aircraft</button>
            <button class="tab-btn" data-tab="environment">Environment</button>
        </div>
        <div id="position" class="tab active"></div>
        <div id="orientation" class="tab"></div>
        <div id="speed" class="tab"></div>
        <div id="controls" class="tab"></div>
        <div id="aircraft" class="tab"></div>
        <div id="environment" class="tab"></div>
    `;
    document.body.appendChild(overlay);

    // Toggle overlay visibility
    document.getElementById('toggle-overlay').addEventListener('click', () => {
        const tabs = overlay.querySelectorAll('.tab, .tab-buttons');
        const isHidden = tabs[0].style.display === 'none';
        tabs.forEach(el => el.style.display = isHidden ? 'block' : 'none');
        document.getElementById('toggle-overlay').textContent = isHidden ? 'Hide' : 'Show';
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Get and format variables
    function getVars() {
        try {
            if (!window.geofs || !window.geofs.aircraft || !window.geofs.aircraft.instance) {
                return {
                    position: 'Aircraft not loaded.',
                    orientation: '',
                    speed: '',
                    controls: '',
                    aircraft: '',
                    environment: ''
                };
            }
            const ac = window.geofs.aircraft.instance;
            const ctrl = window.controls || {};
            const wind = window.geofs.wind || {};

            return {
                position: `
                    Coords (lat/lon): ${ac.latlng ? ac.latlng.map(x => x.toFixed(4)).join(', ') : 'N/A'}<br>
                    Altitude (ft): ${ac.altitude ? ac.altitude.toFixed(1) : 'N/A'}<br>
                    LLA (lat/lon/alt m): ${ac.lla ? ac.lla.map(x => x.toFixed(1)).join(', ') : 'N/A'}
                `,
                orientation: `
                    Heading (°): ${ac.heading360 || ac.heading ? (ac.heading360 || ac.heading).toFixed(1) : 'N/A'}<br>
                    Pitch (°): ${ac.pitch ? ac.pitch.toFixed(1) : 'N/A'}<br>
                    Roll (°): ${ac.roll ? ac.roll.toFixed(1) : 'N/A'}<br>
                    Yaw (°): ${ac.yaw ? ac.yaw.toFixed(1) : 'N/A'}
                `,
                speed: `
                    Ground Speed (kts): ${ac.groundSpeed ? ac.groundSpeed.toFixed(1) : 'N/A'}<br>
                    Airspeed (kts): ${ac.airspeed ? ac.airspeed.toFixed(1) : 'N/A'}<br>
                    Vertical Speed (fpm): ${ac.vspeed ? ac.vspeed.toFixed(1) : 'N/A'}<br>
                    G-Forces (x,y,z): ${ac.acceleration ? Object.values(ac.acceleration).map(x => x.toFixed(1)).join(', ') : 'N/A'}
                `,
                controls: `
                    Throttle: ${ctrl.throttle ? ctrl.throttle.toFixed(2) : 'N/A'}<br>
                    Pitch Input: ${ctrl.pitch ? ctrl.pitch.toFixed(2) : 'N/A'}<br>
                    Roll Input: ${ctrl.roll ? ctrl.roll.toFixed(2) : 'N/A'}<br>
                    Yaw Input: ${ctrl.yaw ? ctrl.yaw.toFixed(2) : 'N/A'}<br>
                    Gear (0-1): ${ctrl.gear != null ? ctrl.gear : 'N/A'}<br>
                    Brakes: ${ctrl.brakes ? ctrl.brakes.toFixed(2) : 'N/A'}<br>
                    Flaps: ${ctrl.flaps ? ctrl.flaps.toFixed(2) : 'N/A'}
                `,
                aircraft: `
                    Aircraft Name: ${ac.definition ? ac.definition.name : 'N/A'}<br>
                    Mass (kg): ${ac.definition && ac.definition.mass ? ac.definition.mass.toFixed(0) : 'N/A'}<br>
                    Engines: ${ac.engines ? ac.engines.map(e => `RPM: ${e.rpm ? e.rpm.toFixed(0) : 'N/A'}`).join(', ') : 'N/A'}
                `,
                environment: `
                    Wind: ${wind.speed != null ? `${wind.speed.toFixed(1)} kts @ ${wind.direction ? wind.direction.toFixed(1) : 'N/A'}°` : 'N/A'}
                `
            };
        } catch (e) {
            return {
                position: `Error: ${e.message}`,
                orientation: '',
                speed: '',
                controls: '',
                aircraft: '',
                environment: ''
            };
        }
    }

    // Update loop
    setInterval(() => {
        const vars = getVars();
        document.getElementById('position').innerHTML = vars.position;
        document.getElementById('orientation').innerHTML = vars.orientation;
        document.getElementById('speed').innerHTML = vars.speed;
        document.getElementById('controls').innerHTML = vars.controls;
        document.getElementById('aircraft').innerHTML = vars.aircraft;
        document.getElementById('environment').innerHTML = vars.environment;
    }, 200);
})();
