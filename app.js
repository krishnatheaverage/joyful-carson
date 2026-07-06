// State Management
let stats = {
    scanned: 0,
    policies: 4,
    blocked: 0,
    fixed: 0
};

let policies = [
    { id: 'POL-001', name: 'Protect Main Branch', category: 'git', trigger: 'push origin main', desc: 'Block direct code commits to the master/main branch.', active: true, severity: 'High' },
    { id: 'POL-002', name: 'Redact Email Credentials', category: 'email', trigger: 'gmail.com', desc: 'Prevent outbound emails to public domains from containing passwords or tokens.', active: true, severity: 'High' },
    { id: 'POL-003', name: 'Mask API Secret Keys', category: 'api', trigger: 'sk-live-', desc: 'Block plaintext API secrets in request headers or body.', active: true, severity: 'Critical' },
    { id: 'POL-004', name: 'Database Guardrail', category: 'db', trigger: 'DROP TABLE', desc: 'Intercept destructive SQL commands and enforce migrations.', active: true, severity: 'Critical' }
];

let auditLogs = [];
let currentScenario = null;
let simulationInterval = null;
let currentSimulationStepIndex = 0;
let isSimulatorRunning = false;

// Predefined Scenario Steps
const scenarios = {
    'git-direct': {
        name: 'Deploy Bugfix to Production',
        steps: [
            { type: 'thought', text: 'Auth bypass detected in auth.js. I need to apply the hotfix to production immediately.' },
            { type: 'action', text: 'git commit -am "fix: authentication validation bypass" && git push origin main' },
            { type: 'check', text: 'Scanning commit payload and target branch...' },
            { 
                type: 'policy_check', 
                policyId: 'POL-001', 
                matchText: 'push origin main',
                violationStep: {
                    type: 'violation',
                    text: 'POL-001 Triggered: Direct commit to main branch is blocked.',
                    fixTitle: '[Archal Fix] Redirect direct commits to feature branch',
                    fixDesc: 'Agent attempted to commit directly to the protected main branch. Archal has blocked this commit and redirected the changes to a new feature branch for audit.',
                    branchFrom: 'main',
                    branchTo: 'feature/agent-patch-auth',
                    diff: `@@ -12,8 +12,8 @@
- // Production hotfix commit by agent
  function verifyUser(username, token) {
-     if (token === "TEMP_BYPASS_TOKEN") return true; 
+     if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(process.env.AUTH_SECRET))) return true;
      return db.checkUser(username, token);
  }`
                },
                passStep: {
                    type: 'pass',
                    text: 'Direct commit allowed (POL-001 Inactive). Pushing changes to master branch directly!'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Creating branch feature/agent-patch-auth and pushing commits...' },
            { type: 'fix', text: 'Fix Pull Request #142 opened: "Merge feature/agent-patch-auth into main"' },
            { type: 'pass', text: 'PR merged successfully! Code verified via CI. Sandbox run completed safely.' }
        ]
    },
    'email-leak': {
        name: 'Customer Credentials Sync',
        steps: [
            { type: 'thought', text: 'Sync log failure detected for customer krish@external.com. Sending log report to support inbox.' },
            { type: 'action', text: "mail -s 'Diagnostic Log' support@gmail.com -body 'Sync status: error, token: sk-live-55928a3f812d, pass_hash: $2b$12$eX82'" },
            { type: 'check', text: 'Scanning email headers and outbound recipients...' },
            {
                type: 'policy_check',
                policyId: 'POL-002',
                matchText: 'gmail.com',
                violationStep: {
                    type: 'violation',
                    text: 'POL-002 Triggered: Outbound mail containing plaintext tokens/hashes sent to public domain blocked.',
                    fixTitle: '[Archal Review] Outbound Email Redaction Approval',
                    fixDesc: 'Agent attempted to send database secrets and API tokens to an external public email address (support@gmail.com). Archal intercepted the dispatch to apply strict masking.',
                    emailTo: 'support@gmail.com',
                    emailSubject: 'Diagnostic Log [Archal Filtered]',
                    emailBody: `Sync status: error, token: <span class="flagged-redaction">sk-live-55928a3f812d</span><span class="redaction-fix">[REDACTED_BY_ARCHAL]</span>, pass_hash: <span class="flagged-redaction">$2b$12$eX82</span><span class="redaction-fix">[REDACTED_BY_ARCHAL]</span>`,
                    redirect: 'support@archal-company.internal'
                },
                passStep: {
                    type: 'pass',
                    text: 'Outbound email sent to public domain containing raw hash secrets (POL-002 Inactive).'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Redacting sensitive keys from email body...' },
            { type: 'fix', text: 'Rerouting recipient to internal whitelisted support inbox...' },
            { type: 'pass', text: 'Masked email dispatched successfully to support@archal-company.internal. Agent run finished.' }
        ]
    },
    'api-secret': {
        name: 'External Service Integration',
        steps: [
            { type: 'thought', text: 'Need to retrieve real-time API logs. Making HTTP POST to billing gateway.' },
            { type: 'action', text: "curl -X POST -H 'Authorization: Bearer sk-live-55928a3f812d' https://api.stripe-billing.com/v1/metrics" },
            { type: 'check', text: 'Analyzing header credentials payload...' },
            {
                type: 'policy_check',
                policyId: 'POL-003',
                matchText: 'sk-live-',
                violationStep: {
                    type: 'violation',
                    text: 'POL-003 Triggered: Plaintext secret Stripe API token in HTTP request header blocked.',
                    fixTitle: '[Archal Fix] Mask Plaintext API Credentials',
                    fixDesc: 'Agent exposed a production Stripe API key in a raw HTTP header call. Archal blocked the request and is opening a PR to migrate to environment variables.',
                    branchFrom: 'main',
                    branchTo: 'config/mask-stripe-key',
                    diff: `@@ -1,3 +1,3 @@
- const stripe = require('stripe')('sk-live-55928a3f812d');
+ const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);`
                },
                passStep: {
                    type: 'pass',
                    text: 'Plaintext secret API keys allowed in request (POL-003 Inactive). Dispatched call.'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Replacing API credentials token with process.env.STRIPE_SECRET_KEY...' },
            { type: 'fix', text: 'Adding entry to local environment sandbox mock keys...' },
            { type: 'pass', text: 'API call successfully dispatched via environment proxy. Agent run complete.' }
        ]
    },
    'db-destructive': {
        name: 'Database Optimization Run',
        steps: [
            { type: 'thought', text: 'Clean-up process: dropping unused backup logs table user_backups_2025.' },
            { type: 'action', text: "db.query('DROP TABLE user_backups_2025')" },
            { type: 'check', text: 'Scanning SQL statement structure...' },
            {
                type: 'policy_check',
                policyId: 'POL-004',
                matchText: 'DROP TABLE',
                violationStep: {
                    type: 'violation',
                    text: 'POL-004 Triggered: Direct destructive raw DROP statement blocked.',
                    fixTitle: '[Archal Fix] Enforce Safe Database Migrations',
                    fixDesc: 'Agent attempted to run a destructive raw DROP TABLE query directly. Archal intercepted it to redirect it into a safe schema migration change log.',
                    branchFrom: 'main',
                    branchTo: 'migration/safe-db-drop',
                    diff: `@@ -0,0 +1,5 @@
+ -- New migration file: migrations/0034_drop_backups.sql
+ ALTER TABLE user_backups_2025 RENAME TO archived_user_backups;
+ -- Scheduled for lazy deletion in 30 days
+ INSERT INTO migration_registry (version, run_date) VALUES ('0034', NOW());`
                },
                passStep: {
                    type: 'pass',
                    text: 'Destructive DROP TABLE query executed directly on database instance (POL-004 Inactive).'
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: 'Wrapping DROP command into transaction migration script...' },
            { type: 'fix', text: 'Creating safe backup schema rename migration registry...' },
            { type: 'pass', text: 'Migration deployed and verified against database replicas. Run completed.' }
        ]
    }
};

// Custom Scenarios Creator based on Custom Policies
function runCustomScenario(command, activePolicy) {
    return {
        name: 'Custom Action Run',
        steps: [
            { type: 'thought', text: 'Executing custom administrator command input.' },
            { type: 'action', text: command },
            { type: 'check', text: `Verifying action against custom policy rules...` },
            {
                type: 'policy_check',
                policyId: activePolicy.id,
                matchText: activePolicy.trigger,
                violationStep: {
                    type: 'violation',
                    text: `${activePolicy.name} Violated: Found matching block keyword "${activePolicy.trigger}". Action Blocked.`,
                    fixTitle: `[Archal Custom Fix] Secure ${activePolicy.name}`,
                    fixDesc: `Custom safety rule violation occurred. Target keyword "${activePolicy.trigger}" was found inside the command payload. Archal blocked raw execution and created a safety wrapper.`,
                    branchFrom: 'main',
                    branchTo: 'patch/custom-guardrail',
                    diff: `@@ -1,2 +1,2 @@
- // Blocked raw usage of: ${command}
+ // Encrypted / Configured wrapper for policy constraint: ${activePolicy.name}`
                },
                passStep: {
                    type: 'pass',
                    text: `Command executed: Policy ${activePolicy.name} was disabled or did not match.`
                }
            }
        ],
        successSteps: [
            { type: 'fix', text: `Wrapping custom payload under security policy metadata...` },
            { type: 'pass', text: 'Execution redirected to safe sandbox buffer. Run finished successfully.' }
        ]
    };
}

// Initialize Application UI
document.addEventListener('DOMContentLoaded', () => {
    renderPolicies();
    updateStats();
    setupEventHandlers();
});

// Render policies in Left Panel
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
                    <span class="tag-severity">${p.severity}</span>
                </div>
                <div class="policy-desc">${p.desc}</div>
            </div>
        `;
        container.appendChild(item);
    });
    
    // Update active policies stat counter
    stats.policies = policies.filter(p => p.active).length;
    updateStats();
}

function togglePolicy(id) {
    const policy = policies.find(p => p.id === id);
    if (policy) {
        policy.active = !policy.active;
        renderPolicies();
    }
}

// Add Custom Policy Form Handler
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
        desc: `Block payload matching keyword "${triggerInput.value}".`,
        active: true,
        severity: 'Medium'
    };
    
    policies.push(newPolicy);
    renderPolicies();
    
    // Reset Form fields
    nameInput.value = '';
    triggerInput.value = '';
});

// Update stats elements
function updateStats() {
    document.getElementById('stats-scanned').innerText = stats.scanned;
    document.getElementById('stats-policies').innerText = stats.policies;
    document.getElementById('stats-blocked').innerText = stats.blocked;
    document.getElementById('stats-fixed').innerText = stats.fixed;
}

// Navigation Tabs
function setupEventHandlers() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    document.getElementById('btn-run-agent').addEventListener('click', startSimulation);
    document.getElementById('btn-reset-agent').addEventListener('click', resetSimulation);
}

// Simulator Core
function startSimulation() {
    if (isSimulatorRunning) return;
    
    isSimulatorRunning = true;
    currentSimulationStepIndex = 0;
    
    // Disable controls during running
    document.getElementById('btn-run-agent').disabled = true;
    document.getElementById('scenario-selector').disabled = true;
    document.getElementById('btn-reset-agent').disabled = false;

    // Pulse lights running state
    setSystemState('running', 'Agent Executing');

    const scenarioKey = document.getElementById('scenario-selector').value;
    currentScenario = scenarios[scenarioKey];

    // Clear Console
    const consoleBody = document.getElementById('console-body');
    consoleBody.innerHTML = '<span class="console-cursor" id="console-cursor"></span>';
    
    // Clear PR Panel
    resetPRPanel();

    runNextSimulationStep();
}

function runNextSimulationStep() {
    if (!isSimulatorRunning) return;

    const currentStep = currentScenario.steps[currentSimulationStepIndex];
    
    if (!currentStep) {
        // Safe completion without violation (if policy was disabled)
        logToConsole('line-info', 'Agent execution finished without violations.');
        setSystemState('idle', 'System Idle');
        finishScenarioRun('success');
        return;
    }

    setTimeout(() => {
        if (currentStep.type === 'thought') {
            logToConsole('line-thought', currentStep.text);
            stats.scanned++;
            updateStats();
            currentSimulationStepIndex++;
            runNextSimulationStep();
        } 
        else if (currentStep.type === 'action') {
            logToConsole('line-action', currentStep.text);
            currentSimulationStepIndex++;
            runNextSimulationStep();
        } 
        else if (currentStep.type === 'check') {
            logToConsole('line-check', currentStep.text);
            currentSimulationStepIndex++;
            runNextSimulationStep();
        } 
        else if (currentStep.type === 'policy_check') {
            // Check if policy is active
            const checkedPolicy = policies.find(p => p.id === currentStep.policyId);
            
            if (checkedPolicy && checkedPolicy.active) {
                // Violated!
                logToConsole('line-violation', currentStep.violationStep.text);
                stats.blocked++;
                updateStats();
                setSystemState('blocked', 'Action Intercepted');
                
                // Show resolution desk
                setTimeout(() => {
                    showResolutionPR(currentStep.violationStep);
                }, 500);
            } else {
                // Policy inactive, pass execution
                logToConsole('line-check', `Policy ${currentStep.policyId} is inactive/disabled. Skipping guardrail.`);
                logToConsole('line-pass', currentStep.passStep.text);
                currentSimulationStepIndex++;
                runNextSimulationStep();
            }
        }
    }, 1200);
}

// Print lines into Terminal
function logToConsole(cssClass, text) {
    const consoleBody = document.getElementById('console-body');
    const cursor = document.getElementById('console-cursor');
    
    const line = document.createElement('div');
    line.className = `console-line ${cssClass}`;
    line.innerText = text;
    
    consoleBody.insertBefore(line, cursor);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}

// Set header lights status
function setSystemState(state, text) {
    const pulse = document.getElementById('global-status-pulse');
    const statusText = document.getElementById('global-status-text');
    const terminalPulse = document.querySelector('.status-pulse');
    
    pulse.className = `status-pulse ${state}`;
    if (terminalPulse) terminalPulse.className = `status-pulse ${state}`;
    statusText.innerText = text;
}

// Populates Resolution desk
function showResolutionPR(violation) {
    const panel = document.getElementById('resolution-panel-content');
    panel.innerHTML = '';
    
    const activeDiv = document.createElement('div');
    activeDiv.className = 'resolution-active';
    
    let templateHTML = '';
    
    if (violation.diff) {
        // Git/API/DB Code Diff PR
        templateHTML = `
            <div class="pr-header">
                <span class="pr-badge">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right: 0.15rem;">
                        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v7a3 3 0 0 0 3 3h6"/><path d="M18 15V9a3 3 0 0 0-3-3h-3"/><path d="M12 3l-3 3 3 3"/>
                    </svg>
                    Fix Pull Request
                </span>
                <div class="pr-title">${violation.fixTitle}</div>
                <div class="pr-branch-flow">
                    <span class="branch-tag">${violation.branchFrom}</span>
                    <span class="arrow-right">&larr;</span>
                    <span class="branch-tag" style="border-color: rgba(139, 92, 246, 0.4); color: #c084fc;">${violation.branchTo}</span>
                </div>
            </div>
            <div class="pr-description-card">
                <h4>Diagnostics Summary</h4>
                <p>${violation.fixDesc}</p>
            </div>
            <div class="diff-container">
                <div class="diff-file-header">
                    <span>Patch Details</span>
                    <span style="font-size:0.6rem; color: var(--accent-green);">+ Additions / - Deletions</span>
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
                <button class="btn-primary" onclick="resolveViolation('approve')">Approve & Merge PR</button>
                <button class="btn-secondary" style="border-color: rgba(244, 63, 94, 0.4); color: #f43f5e;" onclick="resolveViolation('reject')">Reject Action</button>
            </div>
        `;
    } 
    else if (violation.emailTo) {
        // Email Form Redaction
        templateHTML = `
            <div class="pr-header">
                <span class="pr-badge" style="background: rgba(59, 130, 246, 0.1); color: #93c5fd; border-color: rgba(59, 130, 246, 0.3);">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right: 0.15rem;">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/>
                    </svg>
                    Email Filter Approval
                </span>
                <div class="pr-title">${violation.fixTitle}</div>
                <div class="pr-branch-flow">
                    <span class="branch-tag" style="background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.2); color: #f43f5e;">Blocked Outbox</span>
                </div>
            </div>
            <div class="pr-description-card">
                <h4>Diagnostics Summary</h4>
                <p>${violation.fixDesc}</p>
            </div>
            <div class="email-preview">
                <div class="email-header-field">
                    <span class="email-label">From:</span>
                    <span class="email-value">agent@archal-sandbox.internal</span>
                </div>
                <div class="email-header-field">
                    <span class="email-label">Original:</span>
                    <span class="email-value" style="color: var(--accent-red); font-size: 0.75rem;">${violation.emailTo} (Blocked - Public)</span>
                </div>
                <div class="email-header-field" style="border-bottom: 2px solid var(--border-color);">
                    <span class="email-label">Redirect:</span>
                    <span class="email-value" style="color: var(--accent-cyan); font-weight: 500;">${violation.redirect} (Approved Routing)</span>
                </div>
                <div class="email-body-editor">
                    ${violation.emailBody}
                </div>
            </div>
            <div class="resolution-actions">
                <button class="btn-primary" onclick="resolveViolation('approve')">Redact & Send</button>
                <button class="btn-secondary" style="border-color: rgba(244, 63, 94, 0.4); color: #f43f5e;" onclick="resolveViolation('reject')">Reject Action</button>
            </div>
        `;
    }

    activeDiv.innerHTML = templateHTML;
    panel.appendChild(activeDiv);
}

// User action handler for PR Merge/Approve
window.resolveViolation = function(decision) {
    if (decision === 'approve') {
        stats.fixed++;
        updateStats();
        logToConsole('line-fix', 'Compliance PR Approved & Merged by Administrator.');
        
        // Disable resolution buttons
        const actionBtnContainer = document.querySelector('.resolution-actions');
        if (actionBtnContainer) actionBtnContainer.style.display = 'none';

        // Play remaining steps
        playRemainingSteps();
    } else {
        logToConsole('line-violation', 'Action Rejected. Restricting agent runtime execution.');
        logToConsole('line-info', 'Sandbox terminated.');
        setSystemState('idle', 'System Idle');
        finishScenarioRun('rejected');
    }
};

function playRemainingSteps() {
    setSystemState('running', 'Resuming Agent');
    
    let index = 0;
    const steps = currentScenario.successSteps;

    function runSuccessStep() {
        if (!isSimulatorRunning) return;
        
        const step = steps[index];
        if (step) {
            setTimeout(() => {
                if (step.type === 'fix') {
                    logToConsole('line-fix', step.text);
                } else if (step.type === 'pass') {
                    logToConsole('line-pass', step.text);
                }
                index++;
                runSuccessStep();
            }, 1000);
        } else {
            setSystemState('idle', 'System Idle');
            finishScenarioRun('resolved');
        }
    }
    
    runSuccessStep();
}

function finishScenarioRun(status) {
    isSimulatorRunning = false;
    document.getElementById('btn-run-agent').disabled = false;
    document.getElementById('scenario-selector').disabled = false;
    
    // Add to Audit Logs
    const timestamp = new Date().toLocaleTimeString();
    let statusText = '';
    let badgeClass = '';
    
    if (status === 'success') {
        statusText = 'Verified Safe';
        badgeClass = 'success';
    } else if (status === 'resolved') {
        statusText = 'Auto-Fixed (PR Merged)';
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

function resetPRPanel() {
    const panel = document.getElementById('resolution-panel-content');
    panel.innerHTML = `
        <div class="resolution-placeholder" id="resolution-placeholder">
            <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
            <h3>Resolution Panel Idle</h3>
            <p>When an Agent executes a policy-violating action, Archal intercepts it and generates a Fix Pull Request or Redaction preview here.</p>
        </div>
    `;
}

function resetSimulation() {
    isSimulatorRunning = false;
    document.getElementById('btn-run-agent').disabled = false;
    document.getElementById('scenario-selector').disabled = false;
    document.getElementById('btn-reset-agent').disabled = true;
    
    setSystemState('idle', 'System Idle');
    
    const consoleBody = document.getElementById('console-body');
    consoleBody.innerHTML = '<div class="console-line line-info">Console cleared. Sandbox ready. Select a scenario and click "Run Agent" to execute.</div><span class="console-cursor" id="console-cursor"></span>';
    
    resetPRPanel();
}

// Lightbox modal functionality
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

// Utilities
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
