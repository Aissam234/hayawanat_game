import type { Animal } from './engine'
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim()
export const matchesAnimal=(animal:Animal,query:string)=>[animal.name_ar,...(animal.aliases ?? []),animal.scientific_name ?? ''].some(s=>normalize(s).includes(normalize(query)))
