/**
 * Best-effort form autofill for manufacturer product-registration pages,
 * injected into the in-app WebView (password-manager style: we fill, the
 * user reviews and submits). Fields are matched by their name / id / label /
 * placeholder / autocomplete text; already-filled inputs are never touched.
 * Works on the page's main frame only — forms inside iframes and fields we
 * can't recognize fall back to the copy chips in the screen's toolbar.
 */

export interface RegistrationFillData {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  /** Serial / model number as stored on the item */
  serial?: string;
  /** The item's name — used for product/model-name fields */
  product?: string;
  /** MM/DD/YYYY for text inputs */
  purchaseDateUS?: string;
  /** YYYY-MM-DD for <input type="date"> */
  purchaseDateISO?: string;
  store?: string;
  /** Plain number string, e.g. "299.99" */
  price?: string;
}

/** Split "Ada Lovelace King" → { firstName: "Ada", lastName: "Lovelace King" } */
export function splitName(fullName: string): { firstName?: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** "2026-07-03" → "07/03/2026" (forms in the US overwhelmingly want this) */
export function toUSDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

/**
 * Build the JavaScript injected into the WebView. Reports back via
 * postMessage({type:'autofilled', filled: n}).
 */
export function buildAutofillScript(data: RegistrationFillData): string {
  // All user data crosses into page JS through this one JSON literal.
  const payload = JSON.stringify(data);
  return `(function () {
  var data = ${payload};
  function fire(el) {
    ['input', 'change', 'blur'].forEach(function (t) {
      try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) {}
    });
  }
  // React and friends ignore plain .value writes; go through the native setter.
  function setValue(el, value) {
    try {
      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
      var desc = proto && Object.getOwnPropertyDescriptor(proto.prototype, 'value');
      if (desc && desc.set) { desc.set.call(el, value); } else { el.value = value; }
    } catch (e) { el.value = value; }
    fire(el);
  }
  function describe(el) {
    var t = '';
    try { if (el.labels && el.labels.length) t += el.labels[0].textContent + ' '; } catch (e) {}
    t += (el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ';
    t += (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('autocomplete') || '');
    return t.toLowerCase().replace(/[_-]/g, ' ');
  }
  function hasAny(text, keys) {
    return keys.some(function (k) { return text.indexOf(k) !== -1; });
  }
  // Checked in order; an input takes the first rule that matches. The generic
  // "name" rule is last and guarded so it can't grab product/company fields.
  var rules = [
    { keys: ['serial'], value: data.serial },
    { keys: ['email', 'e mail'], value: data.email },
    { keys: ['first name', 'fname', 'given name', 'givenname'], value: data.firstName },
    { keys: ['last name', 'lname', 'surname', 'family name', 'familyname'], value: data.lastName },
    { keys: ['place of purchase', 'purchased from', 'where purchased', 'retailer', 'dealer', 'store', 'merchant', 'seller'], value: data.store },
    { keys: ['price', 'amount paid', 'purchase amount'], value: data.price },
    { keys: ['purchase date', 'date of purchase', 'date purchased', 'purchase'], value: data.purchaseDateUS, isDate: true },
    { keys: ['model'], value: data.serial || data.product },
    { keys: ['product name', 'product', 'item name'], value: data.product },
    { keys: ['full name', 'your name', 'name'], value: data.fullName,
      exclude: ['user', 'company', 'business', 'file', 'nick', 'middle', 'city', 'street'] },
  ];
  var inputs = Array.prototype.slice.call(document.querySelectorAll('input, textarea, select'));
  var skipTypes = { hidden: 1, password: 1, checkbox: 1, radio: 1, file: 1, submit: 1, button: 1, image: 1, reset: 1, search: 1, tel: 1 };
  var filled = 0;
  var firstFilled = null;
  inputs.forEach(function (el) {
    var type = (el.getAttribute('type') || '').toLowerCase();
    if (skipTypes[type]) return;
    if (el.disabled || el.readOnly) return;
    if (el.tagName !== 'SELECT' && el.value) return; // never overwrite user input
    var text = describe(el);
    if (!text.trim()) return;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!r.value) continue;
      if (r.exclude && hasAny(text, r.exclude)) continue;
      if (!hasAny(text, r.keys)) continue;
      if (el.tagName === 'SELECT') {
        // Only try dropdowns for the retailer field (e.g. "Where did you buy it?")
        if (r.value !== data.store) break;
        var want = String(r.value).toLowerCase();
        for (var j = 0; j < el.options.length; j++) {
          var opt = el.options[j].text.toLowerCase();
          if (opt && (opt.indexOf(want) !== -1 || want.indexOf(opt) !== -1) && el.options[j].value) {
            el.selectedIndex = j;
            fire(el);
            filled++;
            el.style.outline = '2px solid #4C7EF3';
            if (!firstFilled) firstFilled = el;
            break;
          }
        }
      } else if (type === 'date') {
        if (!r.isDate || !data.purchaseDateISO) break;
        setValue(el, data.purchaseDateISO);
        filled++;
        el.style.outline = '2px solid #4C7EF3';
        if (!firstFilled) firstFilled = el;
      } else {
        setValue(el, String(r.value));
        filled++;
        el.style.outline = '2px solid #4C7EF3';
        if (!firstFilled) firstFilled = el;
      }
      break;
    }
  });
  if (firstFilled && firstFilled.scrollIntoView) {
    try { firstFilled.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'autofilled', filled: filled }));
  }
})(); true;`;
}
