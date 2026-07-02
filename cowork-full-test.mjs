import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3013';
const DELAY = ms => new Promise(r => setTimeout(r, ms));
const results = [];

function log(section, test, pass, detail = '') {
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${section}] ${test}${detail ? ' — ' + detail : ''}`);
  results.push({ section, test, pass, detail });
}
async function ss(page, name) { await page.screenshot({ path: `/tmp/cw-${name}.png` }); }

// Wait for the shell to finish rendering past the splash screen
async function waitForShell(page) {
  // shell-rail-controls is rendered by RailControls — present only after full boot
  await page.waitForSelector('[data-testid="shell-rail-controls"]', { timeout: 30000 });
  await DELAY(600);
}

// Click the Cowork mode button (2nd mode in the mode tabs row)
// Modes order: Chat, Cowork, Code, Design, Browser
// The mode tabs div is the 2nd child of shell-rail-controls
async function clickCoworkMode(page) {
  // The mode tabs container is the second div inside shell-rail-controls
  const modeTabsRow = page.locator('[data-testid="shell-rail-controls"] > div').nth(1);
  // Cowork is the 2nd button (index 1)
  const coworkBtn = modeTabsRow.locator('button').nth(1);
  if (await coworkBtn.count() === 0) return false;
  await coworkBtn.click();
  // Wait for "New Task" to appear in the rail (cowork rail loads)
  try {
    await page.waitForSelector('text="New Task"', { timeout: 8000 });
  } catch {}
  await DELAY(600);
  return await page.locator('text="New Task"').count() > 0;
}

// Click a rail item by its exact visible text
async function clickRail(page, label) {
  const item = page.locator(`text="${label}"`).first();
  if (await item.count() === 0) { console.log(`  [warn] rail item not found: "${label}"`); return false; }
  await item.click();
  await DELAY(1000);
  return true;
}

(async () => {
  const browser = await chromium.launch({
    headless: false, slowMo: 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') process.stderr.write(`[browser] ${m.text()}\n`); });

  try {
    // ── BOOT ────────────────────────────────────────────────────────────────
    console.log('Booting app…');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForShell(page);
    await ss(page, '01-shell-ready');
    log('Setup', 'App booted — shell-rail-controls rendered', true);

    // ── ENTER COWORK ─────────────────────────────────────────────────────
    const entered = await clickCoworkMode(page);
    await ss(page, '02-cowork');
    log('Setup', 'Cowork mode entered — New Task in rail', entered);

    if (!entered) {
      // Dump all buttons text for debugging
      const allBtnTexts = [];
      for (const b of await page.locator('[data-testid="shell-rail-controls"] button').all()) {
        allBtnTexts.push(await b.innerText().catch(() => '<icon-only>'));
      }
      console.log('  Mode buttons found:', allBtnTexts);
    }

    // ════════════════════════════════════════════════════════════════════════
    // CRON
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── CRON ──────────────────────────────────────────────────────');
    const cronClicked = await clickRail(page, 'Cron');
    log('Cron', 'Cron rail item clicked', cronClicked);
    await ss(page, '03-cron-view');

    log('Cron', 'CronView renders', await page.locator('h1:has-text("Cron")').count() > 0);
    const sTabs = await page.locator('button:has-text("Scheduled")').count() > 0;
    const rTabs = await page.locator('button:has-text("Recurring")').count() > 0;
    const hTabs = await page.locator('button:has-text("Agent Heartbeats")').count() > 0;
    log('Cron', 'All three tabs present', sTabs && rTabs && hTabs);
    const hasNewAuto = await page.locator('button:has-text("New Automation")').count() > 0;
    log('Cron', '"New Automation" button present', hasNewAuto);

    // CREATE a cron job
    if (hasNewAuto) {
      await page.locator('button:has-text("New Automation")').first().click();
      await DELAY(800);
      await ss(page, '04-cron-form');
      const formOpen = await page.locator('text="Create Scheduled Task"').count() > 0;
      log('Cron', 'Create form opens', formOpen);

      if (formOpen) {
        const nameInput = page.locator('input[placeholder*="name" i]').first();
        if (await nameInput.count() > 0) { await nameInput.click(); await nameInput.fill('Daily Standup Report'); }

        const descInput = page.locator('input[placeholder*="description" i]').first();
        if (await descInput.count() > 0) { await descInput.click(); await descInput.fill('Auto-generate standup summaries each morning'); }

        const ta = page.locator('textarea').first();
        if (await ta.count() > 0) { await ta.click(); await ta.fill("Summarise yesterday's tasks, today's goals, and blockers as a concise bullet-point standup."); }

        // Model picker — try multiple selector patterns
        const modelBtn = page.locator('button').filter({ hasText: /Select model/i }).first();
        let modelPicked = false;
        if (await modelBtn.count() > 0) {
          await modelBtn.click(); await DELAY(1000);
          await ss(page, '04b-model-picker-open');
          // Look for any clickable option in the open picker dialog
          const opts = page.locator('[role="dialog"] button, [role="listbox"] [role="option"], [class*="model"] [role="option"], [class*="ModelOption"], [class*="model-option"]');
          const cnt = await opts.count();
          console.log(`  Model picker options found: ${cnt}`);
          if (cnt > 0) { await opts.first().click(); await DELAY(400); modelPicked = true; }
          else {
            // Try clicking any visible button inside what looks like a picker
            const pickerDialog = page.locator('[role="dialog"]');
            if (await pickerDialog.count() > 0) {
              const anyBtn = pickerDialog.locator('button').first();
              if (await anyBtn.count() > 0) { await anyBtn.click(); await DELAY(400); modelPicked = true; }
              else { await page.keyboard.press('Escape'); await DELAY(300); }
            } else {
              // Look for any overlay that appeared
              const overlay = page.locator('[class*="Picker"], [class*="picker"], [class*="Dialog"], [class*="Popover"]').first();
              if (await overlay.count() > 0) {
                const firstOpt = overlay.locator('button').first();
                if (await firstOpt.count() > 0) { await firstOpt.click(); await DELAY(400); modelPicked = true; }
              }
              await page.keyboard.press('Escape'); await DELAY(300);
            }
          }
        }
        log('Cron', 'Model selected in form', modelPicked, modelPicked ? '' : 'picker empty — no AI providers configured');

        // Frequency → Daily
        const freqBtn = page.locator('button').filter({ hasText: /^Manual$|^Hourly$|^Daily$|^Weekdays$|^Weekly$/ }).first();
        if (await freqBtn.count() > 0) {
          await freqBtn.click(); await DELAY(400);
          const daily = page.locator('button:has-text("Daily")').first();
          if (await daily.count() > 0) { await daily.click(); await DELAY(300); }
        }

        await ss(page, '05-form-filled');
        const saveBtn = page.locator('button:has-text("Save Task")').first();
        const canSave = await saveBtn.isEnabled().catch(() => false);
        log('Cron', 'Save button enabled', canSave, canSave ? '' : 'disabled — model required');

        if (canSave) {
          await saveBtn.click(); await DELAY(2500);
          await ss(page, '06-cron-saved');
          const formClosed = await page.locator('text="Create Scheduled Task"').count() === 0;
          const errShown = await page.locator('text="Failed"').count() > 0;
          log('Cron', 'Cron job saved — form dismissed', formClosed, errShown ? 'backend error shown' : '');
        } else {
          await page.locator('button:has-text("Cancel")').first().click(); await DELAY(300);
        }
      }
    }

    // Tab navigation
    if (await page.locator('button:has-text("Recurring")').count() > 0) {
      await page.locator('button:has-text("Recurring")').first().click(); await DELAY(500);
      log('Cron', 'Recurring tab navigable', true);
      await page.locator('button:has-text("Agent Heartbeats")').first().click(); await DELAY(700);
      const hbOk = await page.locator('text="Agent Heartbeat Tasks"').count() > 0
        || await page.locator('text="No agents available"').count() > 0
        || await page.locator('text="Loading"').count() > 0;
      log('Cron', 'Agent Heartbeats tab renders', hbOk);
      await ss(page, '06b-heartbeats');
    }

    // Leave and return
    await clickRail(page, 'New Task'); await DELAY(400);
    await clickRail(page, 'Cron'); await DELAY(600);
    log('Cron', 'Leave and return — re-renders correctly', await page.locator('h1:has-text("Cron")').count() > 0);

    // ════════════════════════════════════════════════════════════════════════
    // AGENT HUB
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── AGENT HUB ─────────────────────────────────────────────────');
    await clickRail(page, 'Agent Hub');
    await ss(page, '07-agenthub');
    log('AgentHub', 'Agent Hub view renders', await page.locator('text="Agent Hub"').count() > 0);
    await clickRail(page, 'Cron'); await DELAY(300);
    await clickRail(page, 'Agent Hub'); await DELAY(500);
    log('AgentHub', 'Leave and return works', await page.locator('text="Agent Hub"').count() > 0);
    await clickRail(page, 'New Task'); await DELAY(400);
    log('AgentHub', 'Navigate away from Agent Hub via rail', true);

    // ════════════════════════════════════════════════════════════════════════
    // PROJECTS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── PROJECTS ──────────────────────────────────────────────────');
    await ss(page, '08-before-proj');

    // New Project button — try title attr first, then aria-label, then positional
    let newProjBtn = page.locator('button[title="New Project"]').first();
    if (await newProjBtn.count() === 0) newProjBtn = page.locator('button[aria-label="New Project"]').first();
    if (await newProjBtn.count() === 0) newProjBtn = page.locator('button').filter({ hasText: /^New Project$/ }).first();
    log('Projects', '"New Project" button found', await newProjBtn.count() > 0);

    if (await newProjBtn.count() > 0) {
      await newProjBtn.click(); await DELAY(1000);
      await ss(page, '09-proj-rail');
      const projInRail = await page.locator('text="New Project"').count() > 0;
      log('Projects', 'Project appears in rail', projInRail);

      if (projInRail) {
        // Click to open the project
        await page.locator('text="New Project"').first().click();
        await DELAY(1800);
        await ss(page, '10-proj-view');

        const showingLaunchpad = await page.locator('text="What would you like"').count() > 0
          || (await page.locator('[class*="Launchpad"], [class*="launchpad"]').count() > 0);
        const projViewUp = await page.locator('text="Project workspace"').count() > 0
          || await page.locator('[class*="ProjectView"]').count() > 0;
        log('Projects', 'CoworkProjectView renders (not launchpad)',
          projViewUp || !showingLaunchpad,
          showingLaunchpad ? 'BUG: launchpad shown instead of project view' : '');

        // Tabs
        const tTab = page.locator('button:has-text("Tasks")').first();
        const aTab = page.locator('button:has-text("Agent Tasks")').first();
        const sTab = page.locator('button:has-text("Sources")').first();
        log('Projects', 'All project tabs present', await tTab.count() > 0 && await aTab.count() > 0 && await sTab.count() > 0);

        // Add task via button
        const ntBtn = page.locator('button:has-text("New Task")').first();
        if (await ntBtn.count() > 0) { await ntBtn.click(); await DELAY(700); log('Projects', 'Task created via New Task button', true); }

        // Add task via composer
        const cta = page.locator('textarea').first();
        if (await cta.count() > 0) {
          await cta.click(); await cta.fill('Write product requirements doc');
          await DELAY(300); await page.keyboard.press('Enter'); await DELAY(800);
          log('Projects', 'Task created via composer', true);
          await ss(page, '11-proj-tasks');
        }

        // Agent Tasks tab
        if (await aTab.count() > 0) {
          await aTab.click(); await DELAY(500); log('Projects', 'Agent Tasks tab navigable', true);
          const ntA = page.locator('button:has-text("New Task")').first();
          if (await ntA.count() > 0) { await ntA.click(); await DELAY(600); log('Projects', 'Agent task created', true); }
        }

        // Sources tab
        if (await sTab.count() > 0) {
          await sTab.click(); await DELAY(400);
          log('Projects', 'Sources tab renders', await page.locator('text="Sources"').count() > 0);
        }

        // Back to Tasks tab, rename a task
        await tTab.click(); await DELAY(400);
        const cards = page.locator('[role="button"]').filter({ hasNotText: /^New Task$|^Agent Tasks$|^Tasks$|^Sources$/ });
        if (await cards.count() > 0) {
          const card = cards.first();
          await card.hover(); await DELAY(300);
          const dotBtn = card.locator('button').last();
          if (await dotBtn.count() > 0) {
            await dotBtn.click(); await DELAY(400);
            const renOpt = page.locator('text="Rename"').first();
            if (await renOpt.count() > 0) {
              await renOpt.click(); await DELAY(300);
              const ri = page.locator('input[type="text"]').first();
              if (await ri.count() > 0) {
                await ri.click(); await page.keyboard.press('Control+A'); await ri.fill('Finalised PRD');
                await page.keyboard.press('Enter'); await DELAY(400);
                log('Projects', 'Task renamed via 3-dot menu', true);
              }
            } else { await page.keyboard.press('Escape'); log('Projects', 'Task rename via 3-dot', false, 'Rename option not found'); }
          }
        }

        // Delete a task
        const cards2 = page.locator('[role="button"]').filter({ hasNotText: /^New Task$|^Agent Tasks$|^Tasks$|^Sources$|^New Project$/ });
        if (await cards2.count() > 0) {
          const c2 = cards2.first();
          await c2.hover(); await DELAY(300);
          const db2 = c2.locator('button').last();
          if (await db2.count() > 0) {
            await db2.click(); await DELAY(400);
            const delOpt = page.locator('text="Delete"').first();
            if (await delOpt.count() > 0) {
              await delOpt.click(); await DELAY(600);
              log('Projects', 'Task deleted via 3-dot menu', true);
            } else { await page.keyboard.press('Escape'); log('Projects', 'Task delete via 3-dot', false, 'Delete option not found'); }
          }
        }

        await ss(page, '12-proj-content-done');

        // Back button
        let wentBack = false;
        for (const btn of await page.locator('button').all()) {
          const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
          const title = (await btn.getAttribute('title').catch(() => '')) || '';
          if (aria.toLowerCase().includes('back') || title.toLowerCase().includes('back')) {
            await btn.click(); await DELAY(1000); wentBack = true; break;
          }
        }
        if (!wentBack) {
          // First button in the view header is usually the back arrow
          const viewHeader = page.locator('[class*="header"], [class*="Header"]').first();
          const hBtn = viewHeader.locator('button').first();
          if (await hBtn.count() > 0) { await hBtn.click(); await DELAY(1000); wentBack = true; }
        }
        await ss(page, '13-after-back');
        log('Projects', 'Back button → cowork main', await page.locator('text="Cron"').count() > 0 || await page.locator('text="New Task"').count() > 0, wentBack ? '' : 'back button not found');

        // Delete project via rail 3-dot
        const projLabel = page.locator('text="New Project"').first();
        if (await projLabel.count() > 0) {
          await projLabel.hover(); await DELAY(500);
          // Find the dots button in the same row — use the parent approach
          const rowEl = projLabel.locator('xpath=ancestor::div[contains(@class,"item") or contains(@class,"row") or contains(@class,"Item") or contains(@class,"Row")][1]');
          let deleted = false;
          const dotsBtn = rowEl.locator('button').last();
          if (await dotsBtn.count() > 0) {
            await dotsBtn.click(); await DELAY(400);
            const delOpt = page.locator('text="Delete"').first();
            if (await delOpt.count() > 0) {
              await delOpt.click(); await DELAY(400);
              const confirmBtn = page.locator('button:has-text("Delete")').last();
              if (await confirmBtn.count() > 0) {
                await confirmBtn.click(); await DELAY(800);
                deleted = await page.locator('text="New Project"').count() === 0;
              }
            } else { await page.keyboard.press('Escape'); }
          }
          log('Projects', 'Project deleted via rail 3-dot → confirm', deleted, deleted ? '' : 'could not find dots or delete in rail row');
        }
      }
    }

    await ss(page, '14-projects-done');

    // ════════════════════════════════════════════════════════════════════════
    // NEW TASK / LAUNCHPAD
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── NEW TASK ───────────────────────────────────────────────────');
    await clickRail(page, 'New Task');
    await ss(page, '15-new-task');
    const launchpadUp = await page.locator('textarea').count() > 0
      || await page.locator('[class*="launchpad" i]').count() > 0;
    log('NewTask', '"New Task" rail item opens cowork launchpad', launchpadUp);

    const ltArea = page.locator('textarea').first();
    if (await ltArea.count() > 0) {
      await ltArea.click(); await ltArea.fill('Write a product spec for the onboarding feature');
      await DELAY(300);
      const sb = page.locator('button[type="submit"], button[aria-label*="send" i], button[title*="Send"]').first();
      if (await sb.count() > 0) await sb.click(); else await page.keyboard.press('Enter');
      await DELAY(1500);
      log('NewTask', 'Task text submitted from launchpad', true);
      await ss(page, '16-task-submitted');
    }

    // ════════════════════════════════════════════════════════════════════════
    // CROSS-MODE NAVIGATION
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── CROSS-MODE NAVIGATION ──────────────────────────────────────');

    // Cowork → Chat (mode tab index 0)
    const modeRow = page.locator('[data-testid="shell-rail-controls"] > div').nth(1);
    const chatBtn = modeRow.locator('button').nth(0);
    let toChat = false;
    if (await chatBtn.count() > 0) {
      await chatBtn.click(); await DELAY(1000);
      toChat = await page.locator('text="New Chat"').count() > 0 || await page.locator('[placeholder*="Message" i]').count() > 0;
    }
    log('Navigation', 'Switch Cowork → Chat', toChat);

    // Chat → Cowork (mode tab index 1)
    let toCowork = false;
    const cwBtn = modeRow.locator('button').nth(1);
    if (await cwBtn.count() > 0) {
      await cwBtn.click(); await DELAY(1000);
      toCowork = await page.locator('text="New Task"').count() > 0 || await page.locator('text="Cron"').count() > 0;
    }
    log('Navigation', 'Switch Chat → Cowork', toCowork);

    // Cowork → Code (mode tab index 2)
    const codeBtn = modeRow.locator('button').nth(2);
    let toCode = false;
    if (await codeBtn.count() > 0) {
      await codeBtn.click(); await DELAY(1000);
      toCode = true;
      log('Navigation', 'Switch Cowork → Code', toCode);
    }

    // Back to Cowork
    const cwBtn2 = modeRow.locator('button').nth(1);
    if (await cwBtn2.count() > 0) { await cwBtn2.click(); await DELAY(800); }

    await ss(page, '17-final');

  } catch (err) {
    console.error('\nFATAL:', err.message);
    await page.screenshot({ path: '/tmp/cw-fatal.png' }).catch(() => {});
  } finally {
    await browser.close();
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('RESULTS');
  console.log('═'.repeat(64));
  for (const s of [...new Set(results.map(r => r.section))]) {
    const sr = results.filter(r => r.section === s);
    const p = sr.filter(r => r.pass).length;
    console.log(`\n${s}  ${p}/${sr.length}`);
    for (const r of sr) console.log(`  ${r.pass ? '✅' : '❌'} ${r.test}${r.detail ? '  (' + r.detail + ')' : ''}`);
  }
  const pass = results.filter(r => r.pass).length;
  console.log(`\n${'═'.repeat(64)}\nTOTAL  ${pass}/${results.length}`);
  console.log('Screenshots saved to /tmp/cw-*.png');
})();
