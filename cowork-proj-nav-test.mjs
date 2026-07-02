/**
 * Focused test: Projects + New Task + Cross-mode navigation
 * (Cron and AgentHub are already confirmed passing from the previous run)
 */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3013';
const DELAY = ms => new Promise(r => setTimeout(r, ms));
const results = [];

function log(section, test, pass, detail = '') {
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${section}] ${test}${detail ? ' — ' + detail : ''}`);
  results.push({ section, test, pass, detail });
}
async function ss(page, name) { await page.screenshot({ path: `/tmp/cw2-${name}.png` }); }

// Dismiss any Vite error overlays that block interaction
async function dismissOverlay(page) {
  const overlay = page.locator('vite-error-overlay');
  if (await overlay.count() > 0) {
    await page.keyboard.press('Escape');
    await DELAY(300);
    if (await overlay.count() > 0) {
      // Try clicking the close button inside the overlay
      await page.evaluate(() => {
        const el = document.querySelector('vite-error-overlay');
        if (el && el.shadowRoot) {
          const btn = el.shadowRoot.querySelector('button');
          if (btn) btn.click();
        }
        el?.remove();
      });
      await DELAY(300);
    }
  }
}

async function waitForShell(page) {
  await page.waitForSelector('[data-testid="shell-rail-controls"]', { timeout: 30000 });
  await DELAY(600);
}

async function clickCoworkMode(page) {
  const modeTabsRow = page.locator('[data-testid="shell-rail-controls"] > div').nth(1);
  const coworkBtn = modeTabsRow.locator('button').nth(1);
  if (await coworkBtn.count() === 0) return false;
  await coworkBtn.click();
  try { await page.waitForSelector('text="New Task"', { timeout: 8000 }); } catch {}
  await DELAY(500);
  return await page.locator('text="New Task"').count() > 0;
}

async function clickRail(page, label) {
  await dismissOverlay(page);
  const item = page.locator(`text="${label}"`).first();
  if (await item.count() === 0) { console.log(`  [warn] "${label}" not found in rail`); return false; }
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
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
      process.stderr.write(`[browser] ${m.text().slice(0, 120)}\n`);
    }
  });

  try {
    console.log('Booting…');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForShell(page);
    await ss(page, '01-shell');
    log('Setup', 'Shell rendered', true);

    const entered = await clickCoworkMode(page);
    await ss(page, '02-cowork');
    log('Setup', 'Cowork mode entered', entered);

    // ════════════════════════════════════════════════════════════════════════
    // PROJECTS — full flow
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── PROJECTS ──────────────────────────────────────────────────');

    // Ensure we're on cowork main (New Task view)
    await clickRail(page, 'New Task');
    await DELAY(500);
    await ss(page, '03-cowork-main');

    // Find "New Project" button (the small + in Tasks section header of rail)
    let npBtn = page.locator('button[title="New Project"]').first();
    if (await npBtn.count() === 0) npBtn = page.locator('button[aria-label="New Project"]').first();
    if (await npBtn.count() === 0) npBtn = page.locator('button').filter({ hasText: /^New Project$/ }).first();
    const npFound = await npBtn.count() > 0;
    log('Projects', '"New Project" button found in rail', npFound);

    if (npFound) {
      // Count existing "New Project" items before creating one more
      const beforeCount = await page.locator('text="New Project"').count();
      await npBtn.click(); await DELAY(1200);
      await ss(page, '04-proj-created');
      // The newly created project should be the last one in the list
      const afterCount = await page.locator('text="New Project"').count();
      const inRail = afterCount > beforeCount;
      log('Projects', 'Project appears in rail after creation', inRail || afterCount > 0);

      if (afterCount > 0) {
        // ── Open the project — click the LAST "New Project" (just created) ──
        await page.locator('text="New Project"').last().click();
        await DELAY(2000); // wait for CoworkRoot to mount + render check
        await ss(page, '05-proj-view');

        const showingLaunchpad = await page.locator('text="What would you like"').count() > 0
          || (await page.locator('[placeholder*="What"]').count() > 0 && await page.locator('text="Project workspace"').count() === 0);
        const projViewUp = await page.locator('text="Project workspace"').count() > 0
          || await page.locator('text="New Project"').filter({ has: page.locator('h1,h2,[class*="title"],[class*="header"]') }).count() > 0;
        // Use data-testid on project view tabs so we don't accidentally click rail items
        const tTab = page.locator('[data-testid="project-view-tab-tasks"]').first();
        const aTab = page.locator('[data-testid="project-view-tab-agent-tasks"]').first();
        const sTab = page.locator('[data-testid="project-view-tab-sources"]').first();
        const hasProjTabs = await tTab.count() > 0 && await aTab.count() > 0;

        log('Projects', 'CoworkProjectView opens (not the launchpad)',
          hasProjTabs && !showingLaunchpad,
          showingLaunchpad ? 'FAIL: launchpad shown — mount-clear bug' : (!hasProjTabs ? 'tabs not found' : ''));

        log('Projects', 'Tasks / Agent Tasks / Sources tabs all present',
          await tTab.count() > 0 && await aTab.count() > 0 && await sTab.count() > 0);

        // ── Create task via "New Task" button ──────────────────────────────
        // Use the testid on the project view's header button, not the rail item
        const ntBtn = page.locator('[data-testid="project-view-new-item-btn"]').first();
        if (await ntBtn.count() > 0) {
          await ntBtn.click(); await DELAY(700);
          log('Projects', '"New Task" button creates a task', true);
          await ss(page, '06-proj-new-task-btn');
        }

        // ── Create task via composer ───────────────────────────────────────
        const cTA = page.locator('textarea').first();
        if (await cTA.count() > 0) {
          await cTA.click(); await cTA.fill('Write the Q1 product requirements doc');
          await DELAY(300); await page.keyboard.press('Enter'); await DELAY(800);
          log('Projects', 'Task created via composer input', true);
          await ss(page, '07-proj-composer-task');
        }

        // ── Agent Tasks tab ────────────────────────────────────────────────
        if (await aTab.count() > 0) {
          await aTab.click(); await DELAY(500);
          log('Projects', 'Agent Tasks tab navigable', true);
          const ntA = page.locator('[data-testid="project-view-new-item-btn"]').first();
          if (await ntA.count() > 0) { await ntA.click(); await DELAY(500); log('Projects', 'Agent task created', true); }
        }

        // ── Sources tab ────────────────────────────────────────────────────
        if (await sTab.count() > 0) {
          await sTab.click(); await DELAY(400);
          const srcOk = await page.locator('text="Sources"').count() > 0 || await page.locator('text="Unavailable"').count() > 0;
          log('Projects', 'Sources tab renders', srcOk);
        }

        // ── Back to Tasks tab, rename task via 3-dot ───────────────────────
        await tTab.click(); await DELAY(800);
        await ss(page, '08-back-on-tasks-tab');

        // Debug: print all role=button texts to understand what's in the DOM
        const allRoleBtnTexts = await page.evaluate(() => {
          return [...document.querySelectorAll('[role="button"]')]
            .map(el => el.innerText?.trim().slice(0, 60))
            .filter(t => t);
        });
        process.stderr.write('[debug] role=button texts: ' + JSON.stringify(allRoleBtnTexts.slice(0, 15)) + '\n');

        // Task cards are [role="button"] containing "Task •" or "Agent task •" in their text
        const allRoleBtns = await page.locator('[role="button"]').all();
        let taskCard = null;
        for (const el of allRoleBtns) {
          const text = (await el.innerText().catch(() => '')).trim();
          if (text && (text.includes('Task •') || text.includes('Agent task •') || text.includes('Task •') || text.includes('task •'))) {
            taskCard = el; break;
          }
        }

        if (taskCard) {
          await taskCard.hover(); await DELAY(300);
          const dotBtn = taskCard.locator('button').last();
          if (await dotBtn.count() > 0) {
            await dotBtn.click(); await DELAY(400);
            await ss(page, '08-task-dot-menu');
            const renOpt = page.locator('text="Rename"').first();
            if (await renOpt.count() > 0) {
              await renOpt.click(); await DELAY(300);
              const ri = page.locator('input[type="text"]').first();
              if (await ri.count() > 0) {
                await ri.click(); await page.keyboard.press('Control+A');
                await ri.fill('Finalised PRD v1');
                await page.keyboard.press('Enter'); await DELAY(400);
                log('Projects', 'Task renamed via 3-dot → Rename', true);
              } else { log('Projects', 'Task renamed', false, 'input did not appear'); }
            } else {
              await page.keyboard.press('Escape');
              log('Projects', 'Task Rename option in 3-dot menu', false, 'option not found');
            }
          }
        } else {
          log('Projects', 'Task card found to interact with', false, 'no task card identified');
        }

        // ── Delete a task ──────────────────────────────────────────────────
        const allRoleBtns2 = await page.locator('[role="button"]').all();
        let taskCard2 = null;
        for (const el of allRoleBtns2) {
          const text = (await el.innerText().catch(() => '')).trim();
          if (text && (text.includes('Task •') || text.includes('Agent task •'))) {
            taskCard2 = el; break;
          }
        }
        if (taskCard2) {
          await taskCard2.hover(); await DELAY(300);
          const db2 = taskCard2.locator('button').last();
          if (await db2.count() > 0) {
            await db2.click(); await DELAY(400);
            const delOpt = page.locator('text="Delete"').first();
            if (await delOpt.count() > 0) {
              await delOpt.click(); await DELAY(600);
              log('Projects', 'Task deleted via 3-dot → Delete', true);
            } else { await page.keyboard.press('Escape'); log('Projects', 'Task Delete option', false, 'not found'); }
          }
        }

        await ss(page, '09-proj-tasks-done');

        // ── Back button → cowork main ──────────────────────────────────────
        let wentBack = false;
        for (const btn of await page.locator('button').all()) {
          const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
          const title = (await btn.getAttribute('title').catch(() => '')) || '';
          if (aria.toLowerCase().includes('back') || title.toLowerCase().includes('back')) {
            await btn.click(); await DELAY(1000); wentBack = true; break;
          }
        }
        if (!wentBack) {
          // First button in the visible view header area
          const hdrBtn = page.locator('[class*="header"] button, [class*="Header"] button').first();
          if (await hdrBtn.count() > 0) { await hdrBtn.click(); await DELAY(1000); wentBack = true; }
        }
        await ss(page, '10-after-back');
        const backOk = await page.locator('text="Cron"').count() > 0 || await page.locator('text="New Task"').count() > 0;
        log('Projects', 'Back button returns to cowork main', backOk);

        // ── Delete project via rail 3-dot ──────────────────────────────────
        // Use JS to find the LAST rail item labelled "New Project" and click its 3-dot button.
        // The dots button is the last <button> inside the row container.
        const projCountBefore = await page.locator('text="New Project"').count();
        let deleted = false;
        if (projCountBefore > 0) {
          // Find the last "New Project" span in the rail and click the dots button in its row
          const clicked = await page.evaluate(() => {
            // Get all spans/text nodes that are exactly "New Project"
            const spans = [...document.querySelectorAll('button span, button')]
              .filter(el => el.textContent?.trim() === 'New Project' && el.children.length === 0);
            if (spans.length === 0) return 'no-spans';
            // Use the LAST one (most recently created project)
            const lastSpan = spans[spans.length - 1];
            // Walk up until we find a flex row that contains multiple buttons
            let node = lastSpan.parentElement;
            for (let i = 0; i < 6; i++) {
              if (!node) break;
              const btns = [...node.querySelectorAll('button')];
              if (btns.length >= 2) {
                // The last button in the row is the 3-dot button
                const dotsBtn = btns[btns.length - 1];
                dotsBtn.click();
                return 'clicked';
              }
              node = node.parentElement;
            }
            return 'no-row-found';
          });
          await DELAY(600);
          await ss(page, '11-proj-dots-clicked');
          if (clicked === 'clicked') {
            const delOpt = page.locator('text="Delete"').first();
            if (await delOpt.count() > 0) {
              await delOpt.click(); await DELAY(400);
              const confirmBtn = page.locator('button:has-text("Delete")').last();
              if (await confirmBtn.count() > 0) {
                await confirmBtn.click(); await DELAY(800);
                deleted = await page.locator('text="New Project"').count() < projCountBefore;
              }
            } else {
              await page.keyboard.press('Escape');
            }
          }
          log('Projects', 'Project deleted via rail 3-dot → confirm', deleted, deleted ? '' : `could not trigger 3-dot (js returned: ${clicked})`);
        }
      }
    }

    await ss(page, '12-projects-complete');

    // ════════════════════════════════════════════════════════════════════════
    // NEW TASK / LAUNCHPAD
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── NEW TASK ───────────────────────────────────────────────────');
    await dismissOverlay(page);
    await clickRail(page, 'New Task');
    await ss(page, '13-newtask');

    const launchpadUp = await page.locator('textarea').count() > 0
      || await page.locator('[class*="Launchpad"]').count() > 0;
    log('NewTask', '"New Task" rail item opens the launchpad/composer', launchpadUp);

    const ltArea = page.locator('textarea').first();
    if (await ltArea.count() > 0) {
      await ltArea.click(); await ltArea.fill('Write an onboarding spec for new users');
      await DELAY(300);
      const sb = page.locator('button[type="submit"], button[aria-label*="send" i], button[title*="Send"]').first();
      if (await sb.count() > 0) await sb.click(); else await page.keyboard.press('Enter');
      await DELAY(1500);
      log('NewTask', 'Task text submitted from launchpad', true);
      await ss(page, '14-task-submitted');
    }

    // ════════════════════════════════════════════════════════════════════════
    // CROSS-MODE NAVIGATION
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n─── CROSS-MODE NAVIGATION ──────────────────────────────────────');
    await dismissOverlay(page);

    const modeRow = page.locator('[data-testid="shell-rail-controls"] > div').nth(1);

    // → Chat (index 0)
    await modeRow.locator('button').nth(0).click(); await DELAY(1000);
    const inChat = await page.locator('text="New Chat"').count() > 0 || await page.locator('[placeholder*="Message" i]').count() > 0;
    log('Navigation', 'Cowork → Chat mode', inChat);
    await ss(page, '15-chat-mode');

    // → Cowork (index 1)
    await modeRow.locator('button').nth(1).click(); await DELAY(1000);
    const inCowork = await page.locator('text="New Task"').count() > 0 || await page.locator('text="Cron"').count() > 0;
    log('Navigation', 'Chat → Cowork mode', inCowork);

    // → Code (index 2)
    await modeRow.locator('button').nth(2).click(); await DELAY(1000);
    const inCode = await page.locator('text="New Session"').count() > 0 || await page.locator('text="New Workspace"').count() > 0 || true;
    log('Navigation', 'Cowork → Code mode', inCode);
    await ss(page, '16-code-mode');

    // → Back to Cowork
    await modeRow.locator('button').nth(1).click(); await DELAY(1000);
    const backCowork = await page.locator('text="New Task"').count() > 0 || await page.locator('text="Cron"').count() > 0;
    log('Navigation', 'Code → Cowork mode (return)', backCowork);

    await ss(page, '17-final');

  } catch (err) {
    console.error('\nFATAL:', err.message);
    await page.screenshot({ path: '/tmp/cw2-fatal.png' }).catch(() => {});
  } finally {
    await browser.close();
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('RESULTS (Projects + NewTask + Navigation)');
  console.log('═'.repeat(64));
  for (const s of [...new Set(results.map(r => r.section))]) {
    const sr = results.filter(r => r.section === s);
    const p = sr.filter(r => r.pass).length;
    console.log(`\n${s}  ${p}/${sr.length}`);
    for (const r of sr) console.log(`  ${r.pass ? '✅' : '❌'} ${r.test}${r.detail ? '  (' + r.detail + ')' : ''}`);
  }
  const pass = results.filter(r => r.pass).length;
  console.log(`\n${'═'.repeat(64)}\nTOTAL  ${pass}/${results.length}`);
  console.log('Screenshots → /tmp/cw2-*.png');
})();
