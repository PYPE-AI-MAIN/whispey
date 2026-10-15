export const BRAND_KEY = 'whispey-brand'

/** Runs before paint (see layout.tsx): `?theme=new` or a saved choice turns the Pype theme on. */
export const BRAND_INIT = `try{var q=new URLSearchParams(location.search).get('theme');if(q==='new'||q==='old')localStorage.setItem('${BRAND_KEY}',q==='new'?'pype':'');if(localStorage.getItem('${BRAND_KEY}')==='pype')document.documentElement.classList.add('pype')}catch(e){}`

export function setBrandTheme(on: boolean) {
  document.documentElement.classList.toggle('pype', on)
  try {
    localStorage.setItem(BRAND_KEY, on ? 'pype' : '')
  } catch {
    // private mode: the choice just lasts for this page
  }
}
