import finnish from './locales/fi.json';

type Catalog = Readonly<Record<string, string>>;
export const languages = {
  en: { name: 'English', messages: {} as Catalog },
  fi: { name: 'Suomi', messages: finnish as Catalog },
};
type Language = keyof typeof languages;
const preferenceKey = 'billiard-language';
let language: Language = 'en';

export function t(message: string, values?: Record<string, string | number>) {
  const catalog = languages[language].messages;
  const translated = Object.prototype.hasOwnProperty.call(catalog, message) ? catalog[message] : message;
  return values ? translated.replace(/\{(\w+)\}/g, (token, name) => String(values[name] ?? token)) : translated;
}

export function installLanguagePicker(onChange?: () => void) {
  const picker = document.querySelector<HTMLElement>('#languagePicker')!;
  const staticText: { source: string; write: (value: string) => void }[] = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const source = node.data.trim();
    if (!source || node.parentElement?.closest('script, style, svg')) continue;
    const original = node.data;
    staticText.push({ source, write: value => { node.data = original.replace(source, () => value); } });
  }
  for (const element of document.querySelectorAll('[title], [aria-label], [alt], [placeholder]')) {
    for (const attribute of ['title', 'aria-label', 'alt', 'placeholder']) {
      const source = element.getAttribute(attribute);
      if (source) staticText.push({ source, write: value => element.setAttribute(attribute, value) });
    }
  }

  const buttons = Object.entries(languages).map(([code, locale]) => {
    const button = document.createElement('button');
    button.className = 'home-back';
    button.type = 'button';
    button.lang = code;
    button.textContent = locale.name;
    button.onclick = () => {
      select(code as Language);
      try { localStorage.setItem(preferenceKey, code); } catch {}
    };
    return { code, button };
  });
  function select(code: Language) {
    language = code;
    document.documentElement.lang = code;
    for (const entry of staticText) entry.write(t(entry.source));
    for (const { code: option, button } of buttons) button.setAttribute('aria-pressed', String(option === code));
    onChange?.();
  }
  picker.append(...buttons.map(({ button }) => button));
  let saved: string | null = null;
  try { saved = localStorage.getItem(preferenceKey); } catch {}
  select(saved && Object.prototype.hasOwnProperty.call(languages, saved) ? saved as Language : 'en');
}
