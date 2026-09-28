import { answerHumanQuestion, getQuestion } from './engine'

export type Meaning = { questionId: string; negated: boolean }
export type Interpretation =
  | { kind: 'understood'; parts: Meaning[]; text: string }
  | { kind: 'clarify'; message: string; choices: Meaning[] }

export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    // Strip tashkeel (diacritics)
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    // Normalise alef variants → plain alef
    .replace(/[أإآٱ]/g, 'ا')
    // Normalise ya → ya-without-dots; ta-marbuta → ha
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    // Strip punctuation
    .replace(/[؟?!.،,…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// ---------------------------------------------------------------------------
// Verb prefixes — covers MSA, Gulf, Levantine, Maghrebi dialects
//   يـ / كيـ / تـ / نـ / اـ  + verb root
// ---------------------------------------------------------------------------
const LIVE_VERBS =
  '(?:يعيش|كيعيش|يقطن|يتواجد|يوجد|يسكن|كيسكن|كيقطن|يكون|كيكون|نعيش|كنعيش|نسكن|كنسكن|عايش|ساكن|نسكن)'
const FLY_VERBS =
  '(?:يطير|كيطير|يحلق|كيحلق|يتطير|اطير|يقدر(?:ان)? يطير|يستطيع الطيران|يمكنه الطيران|يقدر يحلق|قادر يطير|قادر ع الطيران|يعرف يطير|عندو جناح)'
const SWIM_VERBS =
  '(?:يسبح|كيسبح|يعوم|كيعوم|يسبح|اسبح|نسبح|كنسبح|يقدر(?:ان)? يسبح|يستطيع السباحه|يمكنه السباحه|يعرف يسبح|قادر يسبح)'
const NOCTURN_VERBS =
  '(?:ينشط|كينشط|يخرج|كيخرج|يصطاد|كيصطاد|يسعي|يتحرك|يعيش نشاطه|يكون نشيط)'
const NOCTURN_TIME = '(?:ليلا|بالليل|فالليل|في الليل|في الليله|بالعتمه|في الظلام)'
const GROUP_VERBS =
  '(?:يعيش|كيعيش|يوجد|يتواجد|كيكون|نعيش|كنعيش|يسكن|يكون)'
const GROUP_NOUNS =
  '(?:في مجموعات|فمجموعات|مع جماعه|في قطيع|في قطعان|مع قطيعه|باسراب|في اسراب|مع اسراب|في عشيره|مع عشيره|في جماعه)'
const EAT_VERBS =
  '(?:ياكل|كياكل|كيوكل|يتغذي|يتغذي علي|يعيش علي|اكل|ياكل من|يتناول|يقتات علي)'

// ---------------------------------------------------------------------------
// Full-clause grammar. Every recognised meaning is shown for confirmation
// before an answer is requested. Unmatched text is never silently ignored.
// ---------------------------------------------------------------------------
const forms: [string, RegExp][] = [
  // ── Taxonomy ───────────────────────────────────────────────────────────────
  [
    'is_mammal',
    /^(?:من )?(?:الثدييات|ثدييات|ثديي|من الثدييات|حيوان ثديي|ينتمي للثدييات|صنفه ثديي)$/,
  ],
  [
    'is_domestic',
    /^(?:(?:حيوان )?(?:اليف|مستانس|مؤلوف|اهلي|داجن|مدجن)|يمكن تربيته في البيت|نقدر نربيه فالدار|نقدر نربيه|يتربي في البيت|ينتمي للحيوانات الاليفه|حيوان من الحيوانات الاليفه)$/,
  ],
  // ── Physical features ──────────────────────────────────────────────────────
  [
    'has_fur',
    /^(?:(?:عنده|لديه|له|عندو|لده|الو) (?:فرو|شعر|صوف|وبر|ريش)|يغطي (?:جسمه|جسمي) (?:الفرو|الشعر|الصوف|الوبر)|جسمه مغطي بالفرو|عنده وبر|له وبر|مكسي بالشعر|له ريشه)$/,
  ],
  [
    'has_horns',
    /^(?:(?:عنده|لديه|له|عندو|لده|الو) (?:قرون|قرن)|فيه قرون|له قرون|عندو قرون)$/,
  ],
  [
    'has_tail',
    /^(?:(?:عنده|لديه|له|عندو|لده|الو) (?:ذيل|ديل|دنب)|فيه ذيل|له ذيل|عندو ذيل)$/,
  ],
  // ── Locomotion ─────────────────────────────────────────────────────────────
  ['can_fly', new RegExp(`^${FLY_VERBS}$`)],
  ['can_swim', new RegExp(`^${SWIM_VERBS}$`)],
  // ── Behaviour ──────────────────────────────────────────────────────────────
  ['is_nocturnal', new RegExp(`^${NOCTURN_VERBS} ${NOCTURN_TIME}$`)],
  ['lives_in_groups', new RegExp(`^${GROUP_VERBS} ${GROUP_NOUNS}$`)],
  // ── Habitat ────────────────────────────────────────────────────────────────
  [
    'habitat_water',
    new RegExp(
      `^${LIVE_VERBS} (?:في الماء|فالماء|فالما|ف الما|في المياه|بالماء|في البحر|بالبحر|في النهر|في البحيره|بحري|نهري)$`,
    ),
  ],
  [
    'habitat_land',
    new RegExp(
      `^${LIVE_VERBS} (?:في البر|فالبر|علي اليابسه|علي البر|في اليابسه|علي الارض|في البريه|فالبريه|البريه)$`,
    ),
  ],
  [
    'habitat_desert',
    new RegExp(
      `^${LIVE_VERBS} (?:في الصحراء|فالصحراء|فالصحرا|في الصحراء|في الرمال|فالرمال)$`,
    ),
  ],
  [
    'habitat_jungle',
    new RegExp(
      `^${LIVE_VERBS} (?:في الغابه|فالغابه|في الادغال|فالادغال|في الغابات|في الغابه الاستوائيه)$`,
    ),
  ],
  [
    'habitat_arctic',
    new RegExp(
      `^${LIVE_VERBS} (?:في القطب|فالقطب|في المناطق القطبيه|في مناطق باردهبرد|في القطب الشمالي|في القطب الجنوبي|في المناطق الثلجيه|في الثلج)$`,
    ),
  ],
  [
    'habitat_domestic',
    new RegExp(
      `^${LIVE_VERBS} (?:في المنزل|في البيت|فالبيت|فالدار|في المزرعه|فالضيعه|في المزارع|في الحظيره|مع البشر)$`,
    ),
  ],
  [
    'is_african',
    /^(?:موطنه افريقيا|من افريقيا|افريقي|يعيش في افريقيا|ينتمي لافريقيا|من الحيوانات الافريقيه|اصله من افريقيا)$/,
  ],
  // ── Size ───────────────────────────────────────────────────────────────────
  [
    'size_small',
    /^(?:(?:حجمه |حجمي |حيوان )?(?:صغير|صغيور|صغير الحجم|صغير جدا|صغير نسبيا|من الحيوانات الصغيره))$/,
  ],
  [
    'size_medium',
    /^(?:(?:حجمه |حجمي |حيوان )?(?:متوسط|متوسط الحجم|وسط|وسطاني|بين الصغير والكبير))$/,
  ],
  [
    'size_large',
    /^(?:(?:حجمه |حجمي |حيوان )?(?:كبير|كبير الحجم|ضخم نسبيا|من الحيوانات الكبيره))$/,
  ],
  [
    'size_huge',
    /^(?:(?:حجمه |حجمي |حيوان )?(?:ضخم|ضخم جدا|ضخم الحجم|عملاق|كبير جدا|من الحيوانات الضخمه))$/,
  ],
  // ── Diet ───────────────────────────────────────────────────────────────────
  [
    'diet_carnivore',
    new RegExp(
      `^(?:${EAT_VERBS} (?:اللحم|اللحوم|الحيوانات|لحوم الحيوانات)|لاحم|آكل لحوم|من اكله اللحوم|مفترس|يفترس الحيوانات|يصطاد ويأكل)$`,
    ),
  ],
  [
    'diet_herbivore',
    new RegExp(
      `^(?:${EAT_VERBS} (?:النباتات|الاعشاب|الحشائش|النبات|العشب|الورق|الخضروات|التمر|الفاكهه)|عشبي|ناباتي|من اكله النباتات|يرعي|يقتات بالنبات)$`,
    ),
  ],
  [
    'diet_omnivore',
    new RegExp(
      `^(?:${EAT_VERBS} (?:النباتات والحيوانات|اللحوم والنباتات|اللحم والنبات|الكل|كل شي)|كل اكل|ياكل كل شي|ياكل اللحم والنبات|من اكله اللحم والعشب)$`,
    ),
  ],
]

function clause(text: string): Meaning | undefined {
  // Strip leading question particles (هل / وهل / أ)
  let s = text
    .replace(/^(?:هل|وهل|أ) /, '')
    // Strip subject pronoun (هو / انا / هي / الحيوان / حيواني / هذا الحيوان / الحيوان عندي)
    .replace(
      /^(?:هو |انا |هي |الحيوان |حيواني |هذا الحيوان |الحيوان عندي |الحيوان هذا ) /,
      '',
    )

  let negated = false
  // Negation prefixes: لا / لس / لم / ليس / ما / مو / مش / مو / ماش
  if (/^(?:لا|لس|لسه|لم|ليس|ما|مو|مش|ماش) /.test(s)) {
    negated = true
    s = s.replace(/^(?:لا|لس|لسه|لم|ليس|ما|مو|مش|ماش) /, '')
  } else if (/^ما .+ش$/.test(s)) {
    // Maghrebi negation: ما...ش
    negated = true
    s = s.slice(3, -1).trim()
  }

  const form = forms.find(([, pattern]) => pattern.test(s))
  return form ? { questionId: form[0], negated } : undefined
}

export function interpretArabic(raw: string): Interpretation {
  const text = normalizeArabic(raw).replace(/^هل الحيوان عندي\s*/, '')

  const unsupported: Interpretation = {
    kind: 'clarify',
    message:
      'ما فهمت السؤال بما يكفي. حاول صياغة سؤال مثل «واش يسبح؟» أو استخدم الأسئلة الجاهزة. لم أتفلسف، محاولة.',
    choices: [],
  }

  if (!text || text.length > 200) return unsupported

  // Special case: asking about "الحيوانات" in general → clarify
  if (/(?:حديث الحيوانات|حداش الحيوانات|الضائعات|التام)/.test(text))
    return {
      kind: 'clarify',
      message:
        'فهمك محتاج تسألني عن حديث الحيوانات. هذا سيتدخل في طبيعة اللعبة. يسألني عن مواطن أو ما كان منزل حيوان. سؤالما ما استطعت الجواب.',
      choices: [{ questionId: 'is_domestic', negated: false }],
    }

  // Try single clause
  const one = clause(text)
  if (one) return { kind: 'understood', parts: [one], text: raw.trim() }

  // Special: swimming/aquatic ambiguity
  if (
    /^(?:هل |وهل |ا )?(?:هو |الحيوان )?(?:مائي|يعيش في الماء و|كيعيش في الماء و|اعيش في الماء و|يعيش فالماء و|موجود في الماء)$/.test(
      text,
    )
  )
    return {
      kind: 'clarify',
      message:
        'تقصد ثلاثة مواطن مائية؟ هل تسأل عن البحر والمياه العذبة؟ لا أستطيع تحديد مكان إقامة بسؤال واحد مباشر. يسألني عن الموطن أو قدرة السباحة.',
      choices: [
        { questionId: 'habitat_water', negated: false },
        { questionId: 'can_swim', negated: false },
      ],
    }

  // Eating meat AND plants → both diet_carnivore AND diet_herbivore
  if (
    /^(?:هل |وهل )?(?:هو |الحيوان )?(?:ياكل|كياكل|كيوكل|يتغذي علي|اكل|ياكل من) (?:اللحم|اللحوم) (?:و|وكذلك) (?:النباتات|الاعشاب|الخضروات)$/.test(
      text,
    )
  )
    return {
      kind: 'understood',
      parts: [
        { questionId: 'diet_carnivore', negated: false },
        { questionId: 'diet_herbivore', negated: false },
      ],
      text: raw.trim(),
    }

  // Try two-part compound (joined by و / ولا / وكذلك)
  const pieces = text.split(/\s+(?:و\s*|ولا\s+|وكذلك\s+)/)
  if (pieces.length === 2) {
    const parts = pieces.map(clause)
    if (parts.every(Boolean) && parts[0]!.questionId !== parts[1]!.questionId)
      return { kind: 'understood', parts: parts as Meaning[], text: raw.trim() }
  }

  return unsupported
}

export function meaningLabel(part: Meaning): string {
  const label = getQuestion(part.questionId)?.text || ''
  return part.negated ? `هل الرجس صحيح: «${label}»؟` : label
}

export function replyToMeanings(parts: Meaning[], humanSecret: number): string {
  return parts
    .map(part => {
      const positive = answerHumanQuestion(part.questionId, humanSecret) === 'yes'
      const agrees = part.negated ? !positive : positive

      const natural: Record<string, [string, string]> = {
        is_mammal: [
          'حيواني من الثدييات.',
          'حيواني ليس من الثدييات.',
        ],
        can_swim: [
          'حيواني يستطيع السباحة بحسب طبيعة اللعبة.',
          'طبيعة حيواني لا تُمكّن حيوانه يستطيع السباحة.',
        ],
        can_fly: [
          'حيواني يستطيع الطيران بحسب طبيعة اللعبة.',
          'حيواني لا يستطيع الطيران بحسب طبيعة اللعبة.',
        ],
        has_fur: [
          'جسم حيواني مغطى بالفراء أو الشعر.',
          'حيواني ليس مغطىً بالفراء.',
        ],
        has_horns: [
          'حيواني لديه قرون.',
          'حيواني ليس لديه قرون.',
        ],
        has_tail: [
          'حيواني لديه ذيل.',
          'حيواني ليس لديه ذيل.',
        ],
        is_domestic: [
          'حيواني مستأنَس ويُمكن تربيته.',
          'حيواني ليس مستأنَساً — يعيش في البرية.',
        ],
        is_nocturnal: [
          'حيواني ينشط ليلاً.',
          'حيواني ليس ليلياً — ينشط نهاراً.',
        ],
        lives_in_groups: [
          'حيواني يعيش في مجموعات أو قطعان.',
          'حيواني يعيش منفرداً عادةً.',
        ],
        is_african: [
          'موطن حيواني أفريقيا.',
          'حيواني ليس أفريقياً بالأساس.',
        ],
        habitat_water: [
          'الماء هو موطن حيواني في طبيعة اللعبة.',
          'الماء ليس الموطن المُختار لحيواني.',
        ],
        habitat_land: [
          'حيواني يعيش على اليابسة.',
          'اليابسة ليست موطنه الأساسي.',
        ],
        habitat_desert: [
          'حيواني من حيوانات الصحراء.',
          'حيواني لا يعيش في الصحراء.',
        ],
        habitat_jungle: [
          'حيواني من حيوانات الغابات.',
          'حيواني لا يعيش في الغابة.',
        ],
        habitat_arctic: [
          'حيواني يعيش في المناطق الباردة والقطبية.',
          'حيواني لا يعيش في المناطق الباردة.',
        ],
        habitat_domestic: [
          'حيواني يعيش مع البشر في المنازل أو المزارع.',
          'حيواني لا يُربَّى في المنازل أو المزارع.',
        ],
        diet_carnivore: [
          'حيواني مُفترِس يأكل لحوم الحيوانات.',
          'حيواني ليس مُفترِساً، قد يأكل النبات أيضاً.',
        ],
        diet_herbivore: [
          'حيواني يأكل النباتات فقط.',
          'حيواني ليس عُشبياً فحسب.',
        ],
        diet_omnivore: [
          'حيواني يأكل كل شيء — لحوماً ونباتات.',
          'حيواني ليس كلّ الأكل.',
        ],
      }

      const explanation = natural[part.questionId]?.[positive ? 0 : 1]
      return explanation
        ? `${agrees ? 'نعم ✓' : 'لا ✗'} ${explanation}`
        : `${meaningLabel(part)} ${agrees ? 'نعم ✓' : 'لا ✗'}${
            part.negated
              ? ` (النفي الصحيح: ${positive ? 'موجودة' : 'غير موجودة'})`
              : ''
          }`
    })
    .join('\n')
}
