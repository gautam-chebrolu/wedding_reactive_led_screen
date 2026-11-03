const $ = id => document.getElementById(id);
export function mountSharedShowUI({ shared, settings, onConnect, onLeave, startInput, enableCamera, stopCamera, fullscreen, toast }) {
  const dialog = $('shared-show-dialog'), wallDialog = $('wall-device-dialog');
  $('stage').append($('wall-device-button')); // Keep local setup accessible inside native fullscreen.
  function tab(join) { $('shared-create-form').hidden = join; $('shared-join-form').hidden = !join; }
  function error(message) { $('shared-error').textContent = message; $('shared-error').hidden = !message; }
  function connected() {
    $('shared-banner').hidden = false; $('shared-name').textContent = shared.snapshot.name;
    $('shared-role').textContent = shared.isWall ? 'WALL OUTPUT' : 'REMOTE CONTROL';
    document.body.classList.toggle('remote-controller', shared.isController);
    document.body.classList.toggle('shared-wall', shared.isWall);
    $('wall-device-button').hidden = !shared.isWall;
    $('shared-connect-forms').hidden = true; $('shared-session-details').hidden = !shared.isController;
    if (shared.isController) {
      const links = shared.links(); $('controller-link').value = links.controller; $('wall-link').value = links.wall;
      history.replaceState({}, '', links.controller);
    } else { document.body.classList.add('presentation'); $('wall-start-input').disabled = false; }
    onConnect();
  }
  async function operation(form, action) {
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; error('');
    try { await action(); connected(); }
    catch (reason) { error(reason.message); }
    finally { button.disabled = false; for (const input of form.querySelectorAll('input[type="password"]')) input.value = ''; }
  }
  $('shared-show-button').addEventListener('click', () => { if (shared.isWall) wallDialog.showModal(); else dialog.showModal(); });
  $('close-shared').addEventListener('click', () => dialog.close());
  $('shared-tab-create').addEventListener('click', () => tab(false)); $('shared-tab-join').addEventListener('click', () => tab(true));
  $('shared-create-form').addEventListener('submit', event => {
    event.preventDefault(); operation(event.target, () => shared.create($('show-name').value, $('show-password').value, $('show-setup-key').value, settings));
  });
  $('shared-join-form').addEventListener('submit', event => {
    event.preventDefault(); operation(event.target, () => {
      let id = $('show-id').value.trim(); try { id = new URL(id).searchParams.get('show') || id; } catch {}
      return shared.login(id, $('join-password').value);
    });
  });
  for (const [button, input] of [['copy-controller', 'controller-link'], ['copy-wall', 'wall-link']]) $(button).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($(input).value); toast('Link copied.'); }
    catch { $(input).focus(); $(input).select(); toast('Copy the selected link.'); }
  });
  $('open-shared-wall').addEventListener('click', () => { const popup = window.open(shared.links().wall, '_blank', 'noopener'); if (popup === null) toast('If no window opened, copy the wall link and open it in a new tab.'); });
  $('leave-shared').addEventListener('click', () => {
    shared.disconnect(true); history.replaceState({}, '', location.pathname);
    $('shared-banner').hidden = true; $('shared-connect-forms').hidden = false; $('shared-session-details').hidden = true;
    document.body.classList.remove('remote-controller', 'shared-wall'); dialog.close(); onLeave(); toast('Disconnected. The DJ’s wall continues running.');
  });
  function wallSetup() {
    for (const [id, original] of [['wall-mic-device', 'audio-device'], ['wall-camera-device', 'camera-device']]) {
      const select = $(id), current = select.value; select.replaceChildren(...[...$(original).options].map(option => new Option(option.text, option.value)));
      if ([...select.options].some(option => option.value === current)) select.value = current;
    }
    if (!wallDialog.open) wallDialog.showModal();
  }
  $('wall-device-button').addEventListener('click', wallSetup); $('close-wall-setup').addEventListener('click', () => wallDialog.close());
  $('wall-start-input').addEventListener('click', async () => {
    if ($('wall-source').value === 'file') { $('wall-music-file').click(); return; }
    $('wall-start-input').disabled = true;
    try { const label = await startInput($('wall-source').value, $('wall-mic-device').value); $('wall-input-status').textContent = label; }
    catch (reason) { $('wall-input-status').textContent = reason.message; }
    finally { $('wall-start-input').disabled = false; }
  });
  $('wall-music-file').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try { $('wall-input-status').textContent = await startInput('file', '', file); } catch (reason) { $('wall-input-status').textContent = reason.message; }
  });
  $('wall-enable-camera').addEventListener('click', async () => { try { await enableCamera(); $('wall-input-status').textContent = 'Camera enabled on this device.'; } catch (reason) { $('wall-input-status').textContent = reason.message; } });
  $('wall-stop-camera').addEventListener('click', stopCamera);
  $('wall-fullscreen').addEventListener('click', () => { wallDialog.close(); fullscreen(); });
  let cursorTimer;
  window.addEventListener('pointermove', () => {
    if (!shared.isWall) return; document.body.classList.remove('wall-cursor-hidden'); clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add('wall-cursor-hidden'), 2500);
  });
  async function boot() {
    const params = new URLSearchParams(location.search), wall = params.get('wall'), control = params.get('show');
    if (wall) {
      document.body.classList.add('presentation', 'shared-wall'); $('wall-device-button').hidden = false; wallDialog.showModal();
      const key = new URLSearchParams(location.hash.slice(1)).get('key');
      if (key) history.replaceState({}, '', `${location.pathname}?wall=${encodeURIComponent(wall)}`);
      try {
        if (key) await shared.joinWall(wall, key);
        else if (!(await shared.restore(wall, 'wall'))) throw new Error('Open the full wall link from your operator, including its access key.');
        connected(); wallSetup(); $('wall-show-status').textContent = `Connected to ${shared.snapshot.name}.`;
      } catch (reason) { $('wall-show-status').textContent = reason.message; }
    } else if (control) {
      $('show-id').value = control; tab(true);
      if (await shared.restore(control)) connected(); else dialog.showModal();
    }
  }
  return { boot, wallSetup, connected };
}
