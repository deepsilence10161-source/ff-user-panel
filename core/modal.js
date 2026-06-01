/* ====== MODAL ====== */
function openModal(title, html) {
  history.pushState(null, null, null);
  $('modalT').textContent = title; $('modalB').innerHTML = html; $('modalOv').classList.add('show');
}
window.showModal = openModal;
function closeModal() { $('modalOv').classList.remove('show'); }
window._showSetLocation = function() {
  var states = ['Andaman and Nicobar','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
  var h = '<div style="margin-bottom:14px">';
  h += '<div style="font-size:13px;font-weight:700;color:#ffaa00;margin-bottom:12px"><i class="fas fa-map-marker-alt"></i> Set Your Location</div>';
  h += '<div class="f-group"><label>State / City</label>';
  h += '<select class="f-input" id="_locSelect" style="color:#fff;background:var(--card2)">';
  h += '<option value="">-- Select State --</option>';
  states.forEach(function(s) { h += '<option value="' + s + '">' + s + '</option>'; });
  h += '</select></div>';
  h += '<div class="f-group"><label>City (optional)</label>';
  h += '<input type="text" class="f-input" id="_cityInput" placeholder="Your city name...">';
  h += '</div></div>';
  h += '<button onclick="window._saveLocation()" class="f-btn" style="background:linear-gradient(135deg,#ffaa00,#ff8c00);color:#000;font-weight:900">Save Location</button>';
  if (window.openModal) openModal('📍 Set Location', h);
};
window._saveLocation = function() {
  var state = (document.getElementById('_locSelect')||{}).value || '';
  var city = ((document.getElementById('_cityInput')||{}).value||'').trim();
  if (!state) { if(window.toast) toast('State select karo', 'err'); return; }
  var loc = city ? city + ', ' + state : state;
  if (!window.U || !window.db) return;
  window.db.ref('users/' + window.U.uid).update({ city: loc, state: state });
  if (window.UD) { window.UD.city = loc; window.UD.state = state; }
  if (window.toast) toast('📍 Location saved: ' + loc, 'ok');
  if (window.closeModal) closeModal();
  if (window.renderRank) setTimeout(function(){ window.renderRank('rankpoints'); }, 500);
};


/* ====== STATE BANNER ====== */
function applyState() {
  var b = $('stateBanner'); if (!b) return;
  if (!UD) { b.style.display = 'none'; return; }
  if (UD.profileStatus === 'approved') {
    b.style.display = 'none';
  } else if (UD.profileStatus === 'pending') {
    b.className = 'state-banner yellow';
    b.innerHTML = '<i class="fas fa-clock"></i> Profile verification pending. App is in view-only mode until admin approval.';
    b.style.display = 'flex';
  } else {
    b.className = 'state-banner blue';
    b.innerHTML = '<i class="fas fa-info-circle"></i> Complete your profile to participate. <a onclick="navTo(\'profile\')">Go to Profile →</a>';
    b.style.display = 'flex';
  }
}

