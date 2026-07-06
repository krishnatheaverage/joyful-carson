// Stats state
let stats = {
    scanned: 0,
    policies: 4,
    blocked: 0,
    fixed: 0
};

// Security / Compliance Policies for KARA
let policies = [
    { id: 'POL-001', name: 'Optimize Cut Yield', category: 'cut', trigger: 'waste: 42%', desc: 'Flag and recalculate laser cutting paths yielding under 60% yield.', active: true, severity: 'Medium' },
    { id: 'POL-002', name: 'Provenance Verification', category: 'provenance', trigger: 'CONFLICT_ZONE', desc: 'Block import registrations missing blockchain tracing hashes.', active: true, severity: 'Critical' },
    { id: 'POL-003', name: 'Clarity Mismatch Protection', category: 'clarity', trigger: 'variance: VS2', desc: 'Intercept stone syncs where clarity varies > 0.5 steps from registry.', active: true, severity: 'High' },
    { id: 'POL-004', name: 'Synthetic CVD Disclosure', category: 'disclosure', trigger: 'NATURAL_CVD_MISMATCH', desc: 'Block lab-grown CVD diamonds from listing in natural diamond indexes.', active: true, severity: 'Critical' }
];

let auditLogs = [];
let currentScenario = null;
let currentStepIndex = 0;
let isScanning = false;

// 3D Wireframe Diamond Canvas Renderer
const canvas = document.getElementById('diamond-canvas');
const ctx = canvas.getContext('2d');
let rotationAngle = 0;
let isFastRotation = false;

// Diamond Geometry Vertices (X, Y, Z)
const vertices = [];
const edges = [];

function generateDiamondGeometry() {
    // Top flat table face points (radius 20, height +25)
    for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        vertices.push({ x: Math.cos(ang) * 16, y: -25, z: Math.sin(ang) * 16 });
    }
    // Crown outer points (radius 32, height +10)
    for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        vertices.push({ x: Math.cos(ang) * 30, y: -10, z: Math.sin(ang) * 30 });
    }
    // Girdle belt points (radius 34, height 0)
    for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        vertices.push({ x: Math.cos(ang) * 34, y: 0, z: Math.sin(ang) * 34 });
    }
    // Bottom culet point (height -45)
    vertices.push({ x: 0, y: 40, z: 0 }); // Index 24 (culet)

    // Edges connections
    // 1. Table face loop (0 to 7)
    for (let i = 0; i < 8; i++) {
        edges.push([i, (i + 1) % 8]);
    }
    // 2. Crown upper facets (Table to Crown Outer: i -> i + 8)
    for (let i = 0; i < 8; i++) {
        edges.push([i, i + 8]);
        edges.push([i, ((i + 1) % 8) + 8]);
    }
    // 3. Crown loop (8 to 15)
    for (let i = 0; i < 8; i++) {
        edges.push([i + 8, ((i + 1) % 8) + 8]);
    }
    // 4. Girdle facets (Crown to Girdle Outer: i + 8 -> i + 16)
    for (let i = 0; i < 8; i++) {
        edges.push([i + 8, i + 16]);
    }
    // 5. Girdle loop (16 to 23)
    for (let i = 0; i < 8; i++) {
        edges.push([i + 16, ((i + 1) % 8) + 16]);
    }
    // 6. Lower Pavilion facets (Girdle to Culet: i + 16 -> 24)
    for (let i = 0; i < 8; i++) {
        edges.push([i + 16, 24]);
    }
}

// 3D Projection Math
function render3DDiamond() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Scale canvas to match bounding container size dynamically
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    
    const scale = 2.4;
    const distance = 100;
    
    // Increment rotation speed
    rotationAngle += isFastRotation ? 0.08 : 0.015;
    
    const pitch = 0.4; // constant look-down angle
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosY = Math.cos(rotationAngle);
    const sinY = Math.sin(rotationAngle);
    
    // Map & Project Vertices
    const projected = vertices.map(v => {
        // Rotate Y (Yaw)
        let x1 = v.x * cosY - v.z * sinY;
        let z1 = v.x * sinY + v.z * cosY;
        let y1 = v.y;
        
        // Rotate X (Pitch)
        let y2 = y1 * cosP - z1 * sinP;
        let z2 = y1 * sinP + z1 * cosP;
        
        // Perspective projection
        const pScale = (distance / (z2 + distance)) * scale;
        return {
            x: x1 * pScale + width / 2,
            y: y2 * pScale + height / 2,
            z: z2
        };
    });
    
    // Draw edges
    edges.forEach(edge => {
        const p1 = projected[edge[0]];
        const p2 = projected[edge[1]];
        
        // Depth-based transparency/fade
        const depth = (p1.z + p2.z) / 2;
        const alpha = Math.max(0.08, 1 - (depth + 40) / 100);
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        
        // Color lines - shift to cyan or white
        if (isFastRotation) {
            ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.85})`;
            ctx.lineWidth = 1.2;
        } else {
            ctx.strokeStyle = `rgba(224, 242, 254, ${alpha * 0.65})`;
            ctx.lineWidth = 0.8;
        }
        ctx.stroke();
    });
    
    // Draw Vertices as glowing dots
    projected.forEach(p => {
        const alpha = Math.max(0.1, 1 - (p.z + 40) / 100);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = isFastRotation ? `rgba(14, 165, 233, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
        
        if (isFastRotation && Math.random() > 0.8) {
            // Draw a subtle sparkle halo
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(14, 165, 233, 0.15)`;
            ctx.stroke();
        }
    });
    
    requestAnimationFrame(render3DDiamond);
}

// Preconfigured Diamond Scan Scenarios
const scenarios = {
    'rough-provenance': {
        name: 'Rough Import Registry (Provenance)',
        steps: [
            { type: 'thought', text: 'Staging optical scans on raw rough specimen import #SL-8834.' },
            { type: 'action', text: 'laser.tomography.scan() -> mapping spatial volume grid...' },
            { type: 'action', text: 'ledger.fetchOriginProvenance(rough_id: "SL-8834")' },
            { type: 'check', text: 'Evaluating Kimberley Process blockchain certificate coordinates...' },
            {
                type: 'policy_check',
                policyId: 'POL-002',
                matchText: 'CONFLICT_ZONE',
                violationStep: {
                    type: 'violation',
                    text: 'POL-002 Triggered: Sierra Leone import SL-8834 lacks verified origin certificate. Action blocked.',
                    fixTitle: '[KARA Fix] Link Kimberley Blockchain Origin Registry',
                    fixDesc: 'Agent attempted to register a rough diamond sourced from an unverified origin (SL-8834). KARA blocked the transaction and generated a PR to link verified certificates.',
                    branchFrom: 'main',
                    branchTo: 'provenance/verify-kp-8834',
                    diff: `@@ -4,4 +4,4 @@
- source_origin: "UNVERIFIED / CONFLICT_ZONE_SIERRA_LEONE"
+ source_origin: "KP-BLOCK-INDEX-8834291-KBL"
+ blockchain_verification_hash: "0x8fa92b3c7793de"
+ provenance_approved: true`
                },
                passStep: {
                    type: 'pass',
                    text: 'Provenance checked bypassed (POL-002 Inactive). Rough stone index updated without tracing records.'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Linking verified Kimberley block ID index KP-BLOCK-INDEX-8834291-KBL...' },
            { type: 'fix', text: 'Injecting verified cryptographic hash 0x8fa92b3c...' },
            { type: 'pass', text: 'Rough diamond import SL-8834 successfully registered into conflict-free registry ledger.' }
        ]
    },
    'gia-conflict': {
        name: 'GIA Certificate Sync (Clarity)',
        steps: [
            { type: 'thought', text: 'Scanning cut specimen facets. Comparing mapping array with external GIA database.' },
            { type: 'action', text: 'spectrometer.gradeClarity() -> mapped 3 internal carbon crystals in crown.' },
            { type: 'action', text: 'gia.fetchRecord(cert_id: "119283")' },
            { type: 'check', text: 'Comparing physical clarity grade VS2 against certified VVS1 records...' },
            {
                type: 'policy_check',
                policyId: 'POL-003',
                matchText: 'variance: VS2',
                violationStep: {
                    type: 'violation',
                    text: 'POL-003 Triggered: Physical clarity grade VS2 deviates from GIA VVS1 certificate. Action blocked.',
                    fixTitle: '[KARA Review] Schedule Dual-Inspector Clarity Auditing',
                    fixDesc: 'KARA mapped a clarity level of VS2 on cert #119283, which is certified VVS1 (> 0.5 step variance). Scanning registry update blocked for audit route.',
                    branchFrom: 'main',
                    branchTo: 'audit/clarity-variance-119283',
                    diff: `@@ -10,4 +10,4 @@
- gia_clarity_grade: "VVS1"
+ scanned_clarity_variance: "VS2"
+ audit_state: "PENDING_DUAL_HUMAN_INSPECTION"
+ safety_hold_active: true`
                },
                passStep: {
                    type: 'pass',
                    text: 'Clarity variance validation bypassed (POL-003 Inactive). Mismatched GIA record synced to inventory.'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Routing record to human dual-grading inspection queue...' },
            { type: 'fix', text: 'Applying safety-hold locks in inventory API registry...' },
            { type: 'pass', text: 'Sync locked. Inspection ticket generated. Diamond registry safe-state secured.' }
        ]
    },
    'cvd-disclosure': {
        name: 'Lab-Grown CVD Check (Disclosure)',
        steps: [
            { type: 'thought', text: 'Measuring UV spectrometry lattice absorption to confirm stone structure.' },
            { type: 'action', text: 'spectrometer.measureAbsorptionRatio() -> ratio: 1.48 (Lab range)' },
            { type: 'check', text: 'Verifying classification index target for the listing request...' },
            {
                type: 'policy_check',
                policyId: 'POL-004',
                matchText: 'NATURAL_CVD_MISMATCH',
                violationStep: {
                    type: 'violation',
                    text: 'POL-004 Triggered: CVD lab-grown diamond registry to natural index blocked.',
                    fixTitle: '[KARA Fix] Apply CVD Lab-Grown Disclosure Tagging',
                    fixDesc: 'Spectrometer detected synthetic CVD growth markers. Intercepted attempts to list the stone as natural, generating index re-routing parameters.',
                    branchFrom: 'main',
                    branchTo: 'disclosure/re-route-cvd',
                    diff: `@@ -2,4 +2,4 @@
- diamond_origin_class: "NATURAL_EARTH_MINED"
+ diamond_origin_class: "LAB_GROWN_CVD"
- listing_index: "NATURAL_DIAMOND_EXCHANGE"
+ listing_index: "CVD_SYNTHETIC_EXCHANGE"`
                },
                passStep: {
                    type: 'pass',
                    text: 'Synthetic check bypassed (POL-004 Inactive). Lab-grown diamond registered on natural exchange index.'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Re-routing registration parameters to CVD synthetic index...' },
            { type: 'fix', text: 'Applying synthetic warning flag tags to catalog record metadata...' },
            { type: 'pass', text: 'Disclosure tags applied successfully. Re-routed listing index. Stone indexed.' }
        ]
    },
    'cut-efficiency': {
        name: 'Laser Cutting Plan (Cut Yield)',
        steps: [
            { type: 'thought', text: 'Staging laser cutting coordinates mapping to plan rough cutting.' },
            { type: 'action', text: 'cuttingPlanner.generateLaserPaths() -> target: Round Brilliant (waste: 42%)' },
            { type: 'check', text: 'Evaluating material yield parameters...' },
            {
                type: 'policy_check',
                policyId: 'POL-001',
                matchText: 'waste: 42%',
                violationStep: {
                    type: 'violation',
                    text: 'POL-001 Triggered: Cutting yield is 58% (waste 42% exceeding threshold). Laser lock active.',
                    fixTitle: '[KARA Fix] Recalculate Laser Path Proportions',
                    fixDesc: 'Planned cut path wasted too much volume. Recalculated coordinates to tweak table width and crown angles to maximize carat weight yield.',
                    branchFrom: 'main',
                    branchTo: 'cut/yield-optimization-882',
                    diff: `@@ -12,6 +12,6 @@
- table_size_pct: 61.2
+ table_size_pct: 57.5
- crown_angle_deg: 34.5
+ crown_angle_deg: 32.8
- estimated_carats: 1.84
+ estimated_carats: 2.12`
                },
                passStep: {
                    type: 'pass',
                    text: 'Low yield cutting plan permitted (POL-001 Inactive). Initializing laser cut paths.'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Adjusting laser cutter focus table parameters to 57.5%...' },
            { type: 'fix', text: 'Setting target output carat estimate weight to 2.12...' },
            { type: 'pass', text: 'Yield coordinates optimized. Laser paths sent to cutter console safely. Cut ready.' }
        ]
    }
};

// Custom policy scanner evaluator
function runCustomScan(inputCommand, triggeredPolicy) {
    return {
        name: 'Custom Parameter Scan',
        steps: [
            { type: 'thought', text: 'Scanning custom laser telemetry string parameters.' },
            { type: 'action', text: inputCommand },
            { type: 'check', text: 'Verifying custom parameter strings against local guardrail rules...' },
            {
                type: 'policy_check',
                policyId: triggeredPolicy.id,
                matchText: triggeredPolicy.trigger,
                violationStep: {
                    type: 'violation',
                    text: `Guardrail ${triggeredPolicy.id} Violated: Found block parameter "${triggeredPolicy.trigger}". Laser locks active.`,
                    fixTitle: `[KARA Custom Fix] Override Custom Parameter ${triggeredPolicy.id}`,
                    fixDesc: `Custom safety rule blocked registry process. Found target keyword "${triggeredPolicy.trigger}" in inputs. Generated safety correction configuration parameters.`,
                    branchFrom: 'main',
                    branchTo: 'custom/guardrail-patch',
                    diff: `@@ -1,2 +1,2 @@
- // Blocked input: ${inputCommand}
+ // Encrypted / Configured parameters enforcing: ${triggeredPolicy.name}`
                },
                passStep: {
                    type: 'pass',
                    text: `Telemetry parameter scanned. Rule ${triggeredPolicy.name} was disabled or bypassed.`
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Applying safety envelope configuration tags...' },
            { type: 'pass', text: 'Scan telemetry verified. Parameters safely logged. Registration complete.' }
        ]
    };
}

// Initial Loading
document.addEventListener('DOMContentLoaded', () => {
    generateDiamondGeometry();
    render3DDiamond();
    renderPolicies();
    updateStats();
    setupEventHandlers();
});

// Render policy switches
function renderPolicies() {
    const container = document.getElementById('policies-container');
    container.innerHTML = '';
    
    policies.forEach(p => {
        const item = document.createElement('div');
        item.className = `policy-item ${p.active ? '' : 'inactive'}`;
        item.innerHTML = `
            <div class="policy-checkbox-container">
                <label class="switch">
                    <input type="checkbox" ${p.active ? 'checked' : ''} onchange="togglePolicy('${p.id}')">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="policy-details">
                <div class="policy-meta">
                    <span class="policy-name">${p.name}</span>
                    <span class="policy-tag tag-${p.category}">${p.category}</span>
                    <span class="tag-severity" style="font-size:0.55rem; color:var(--text-secondary); opacity:0.8;">${p.severity}</span>
                </div>
                <div class="policy-desc">${p.desc}</div>
            </div>
        `;
        container.appendChild(item);
    });
    
    stats.policies = policies.filter(p => p.active).length;
    updateStats();
}

function togglePolicy(id) {
    const p = policies.find(p => p.id === id);
    if (p) {
        p.active = !p.active;
        renderPolicies();
    }
}

// Add Custom Policy Form
document.getElementById('policy-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('policy-name');
    const typeInput = document.getElementById('policy-type');
    const triggerInput = document.getElementById('policy-trigger');
    
    const newPolicy = {
        id: `POL-00${policies.length + 1}`,
        name: nameInput.value,
        category: typeInput.value,
        trigger: triggerInput.value,
        desc: `Block command inputs matching parameter keyword "${triggerInput.value}".`,
        active: true,
        severity: 'Medium'
    };
    
    policies.push(newPolicy);
    renderPolicies();
    
    nameInput.value = '';
    triggerInput.value = '';
});

// Update stats numbers
function updateStats() {
    document.getElementById('stats-scanned').innerText = stats.scanned;
    document.getElementById('stats-policies').innerText = stats.policies;
    document.getElementById('stats-blocked').innerText = stats.blocked;
    document.getElementById('stats-fixed').innerText = stats.fixed;
}

// Event hooks
function setupEventHandlers() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    document.getElementById('btn-run-agent').addEventListener('click', startScanSimulation);
    document.getElementById('btn-reset-agent').addEventListener('click', resetScanSimulation);
}

// Running the simulation
function startScanSimulation() {
    if (isScanning) return;
    
    isScanning = true;
    currentStepIndex = 0;
    
    document.getElementById('btn-run-agent').disabled = true;
    document.getElementById('scenario-selector').disabled = true;
    document.getElementById('btn-reset-agent').disabled = false;
    
    // Animate spinning fast and laser line
    isFastRotation = true;
    document.getElementById('visualizer-container').classList.add('laser-active');
    
    setSystemState('running', 'Laser Mapping Active');

    const scenarioKey = document.getElementById('scenario-selector').value;
    currentScenario = scenarios[scenarioKey];

    const consoleBody = document.getElementById('console-body');
    consoleBody.innerHTML = '<span class="console-cursor" id="console-cursor"></span>';
    
    resetResolutionPanel();
    runNextStep();
}

function runNextStep() {
    if (!isScanning) return;
    
    const step = currentScenario.steps[currentStepIndex];
    if (!step) {
        logToConsole('line-info', 'Scan finished. Crystal integrity logs stored.');
        setSystemState('idle', 'Scan Core Idle');
        isFastRotation = false;
        document.getElementById('visualizer-container').classList.remove('laser-active');
        finishScanRun('success');
        return;
    }

    setTimeout(() => {
        if (step.type === 'thought') {
            logToConsole('line-thought', step.text);
            stats.scanned++;
            updateStats();
            currentStepIndex++;
            runNextStep();
        } 
        else if (step.type === 'action') {
            logToConsole('line-action', step.text);
            currentStepIndex++;
            runNextStep();
        } 
        else if (step.type === 'check') {
            logToConsole('line-check', step.text);
            currentStepIndex++;
            runNextStep();
        } 
        else if (step.type === 'policy_check') {
            const checkedPolicy = policies.find(p => p.id === step.policyId);
            
            if (checkedPolicy && checkedPolicy.active) {
                // Violated! Block and show PR
                logToConsole('line-violation', step.violationStep.text);
                stats.blocked++;
                updateStats();
                setSystemState('blocked', 'Scan Intercepted');
                isFastRotation = false;
                document.getElementById('visualizer-container').classList.remove('laser-active');
                
                setTimeout(() => {
                    showResolutionPR(step.violationStep);
                }, 400);
            } else {
                // Bypass
                logToConsole('line-check', `Guardrail policy ${step.policyId} is inactive. Skipping check.`);
                logToConsole('line-pass', step.passStep.text);
                currentStepIndex++;
                runNextStep();
            }
        }
    }, 1200);
}

function logToConsole(cssClass, text) {
    const consoleBody = document.getElementById('console-body');
    const cursor = document.getElementById('console-cursor');
    
    const line = document.createElement('div');
    line.className = `console-line ${cssClass}`;
    line.innerText = text;
    
    consoleBody.insertBefore(line, cursor);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}

function setSystemState(state, text) {
    const pulse = document.getElementById('global-status-pulse');
    const statusText = document.getElementById('global-status-text');
    pulse.className = `status-pulse ${state}`;
    statusText.innerText = text;
}

// Show PR resolution details
function showResolutionPR(violation) {
    const panel = document.getElementById('resolution-panel-content');
    panel.innerHTML = '';
    
    const activeDiv = document.createElement('div');
    activeDiv.className = 'resolution-active';
    
    activeDiv.innerHTML = `
        <div class="pr-header">
            <span class="pr-badge">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right: 0.15rem;">
                    <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v7a3 3 0 0 0 3 3h6"/><path d="M18 15V9a3 3 0 0 0-3-3h-3"/><path d="M12 3l-3 3 3 3"/>
                </svg>
                Correction PR
            </span>
            <div class="pr-title">${violation.fixTitle}</div>
            <div class="pr-branch-flow">
                <span class="branch-tag">${violation.branchFrom}</span>
                <span class="arrow-right" style="color: var(--accent-cyan); font-weight: bold;">&larr;</span>
                <span class="branch-tag" style="border-color: rgba(14, 165, 233, 0.4); color: var(--accent-cyan);">${violation.branchTo}</span>
            </div>
        </div>
        <div class="pr-description-card">
            <h4>Scan Diagnostics</h4>
            <p>${violation.fixDesc}</p>
        </div>
        <div class="diff-container">
            <div class="diff-file-header">
                <span>Certification Registry Patch</span>
                <span style="font-size:0.6rem; color: var(--accent-green);">+ Correct / - Mismatched</span>
            </div>
            <div class="diff-body">
                ${violation.diff.split('\n').map((line, idx) => {
                    let cls = '';
                    if (line.startsWith('-')) cls = 'deletion';
                    else if (line.startsWith('+')) cls = 'addition';
                    else if (line.startsWith('@@')) cls = 'info';
                    
                    return `
                        <div class="diff-line ${cls}">
                            <span class="diff-line-num">${idx + 1}</span>
                            <span class="diff-line-content">${escapeHTML(line)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="resolution-actions">
            <button class="btn-primary" onclick="resolveScanCorrection('approve')">Approve & Sync</button>
            <button class="btn-secondary" style="border-color: rgba(244, 63, 94, 0.4); color: var(--accent-red);" onclick="resolveScanCorrection('reject')">Abort Scan</button>
        </div>
    `;
    
    panel.appendChild(activeDiv);
}

// User action handler
window.resolveScanCorrection = function(decision) {
    if (decision === 'approve') {
        stats.fixed++;
        updateStats();
        logToConsole('line-fix', 'Correction PR Approved. Overwriting mismatch indexes in database...');
        
        const actionBtnContainer = document.querySelector('.resolution-actions');
        if (actionBtnContainer) actionBtnContainer.style.display = 'none';

        resumeScanSuccessSteps();
    } else {
        logToConsole('line-violation', 'Operator aborted registration. Clearing spectrometer memory.');
        logToConsole('line-info', 'Scan registry halted.');
        setSystemState('idle', 'Scan Core Idle');
        finishScanRun('rejected');
    }
};

function resumeScanSuccessSteps() {
    setSystemState('running', 'Syncing Database');
    isFastRotation = true;
    document.getElementById('visualizer-container').classList.add('laser-active');
    
    let index = 0;
    const steps = currentScenario.successSteps;

    function nextSuccess() {
        if (!isScanning) return;
        
        const step = steps[index];
        if (step) {
            setTimeout(() => {
                if (step.type === 'fix') {
                    logToConsole('line-fix', step.text);
                } else if (step.type === 'pass') {
                    logToConsole('line-pass', step.text);
                }
                index++;
                nextSuccess();
            }, 1000);
        } else {
            setSystemState('idle', 'Scan Core Idle');
            isFastRotation = false;
            document.getElementById('visualizer-container').classList.remove('laser-active');
            finishScanRun('resolved');
        }
    }
    
    nextSuccess();
}

function finishScanRun(status) {
    isScanning = false;
    document.getElementById('btn-run-agent').disabled = false;
    document.getElementById('scenario-selector').disabled = false;
    
    const timestamp = new Date().toLocaleTimeString();
    let statusText = '';
    let badgeClass = '';
    
    if (status === 'success') {
        statusText = 'Verified Pass';
        badgeClass = 'success';
    } else if (status === 'resolved') {
        statusText = 'Corrected & Registered';
        badgeClass = 'violation-fixed';
    } else {
        statusText = 'Blocked & Aborted';
        badgeClass = 'violation-blocked';
    }

    const newAudit = {
        name: currentScenario.name,
        time: timestamp,
        status: statusText,
        badgeClass: badgeClass
    };
    
    auditLogs.unshift(newAudit);
    renderAuditLogs();
}

function renderAuditLogs() {
    const list = document.getElementById('audit-logs-list');
    list.innerHTML = '';
    
    auditLogs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'audit-log-item';
        item.innerHTML = `
            <div class="log-meta-left">
                <span class="log-scenario-name">${log.name}</span>
                <span class="log-time">Executed at ${log.time}</span>
            </div>
            <div>
                <span class="log-badge ${log.badgeClass}">${log.status}</span>
            </div>
        `;
        list.appendChild(item);
    });
}

function resetResolutionPanel() {
    const panel = document.getElementById('resolution-panel-content');
    panel.innerHTML = `
        <div class="resolution-placeholder" id="resolution-placeholder">
            <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
            <h3>Spectrography Interceptor Idle</h3>
            <p>When KARA's diamond analysis flags a grading mismatch or lack of provenance coordinates, the correction PR will open here.</p>
        </div>
    `;
}

function resetScanSimulation() {
    isScanning = false;
    isFastRotation = false;
    document.getElementById('visualizer-container').classList.remove('laser-active');
    
    document.getElementById('btn-run-agent').disabled = false;
    document.getElementById('scenario-selector').disabled = false;
    document.getElementById('btn-reset-agent').disabled = true;
    
    setSystemState('idle', 'Scan Core Offline');
    
    const consoleBody = document.getElementById('console-body');
    consoleBody.innerHTML = '<div class="console-line line-info">KARA Scan Core initialized. Place a diamond index and click "Scan Stone".</div><span class="console-cursor" id="console-cursor"></span>';
    
    resetResolutionPanel();
}

// Lightbox Modal functions
window.openLightbox = function(src, title, desc) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const titleEl = document.getElementById('lightbox-title');
    const descEl = document.getElementById('lightbox-desc');
    
    img.src = src;
    titleEl.innerText = title;
    descEl.innerText = desc;
    lightbox.style.display = 'flex';
};

window.closeLightbox = function() {
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'none';
};

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
