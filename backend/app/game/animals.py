"""
Animal dataset for لعبة الحيوانات.
Each animal has: id, name_ar, emoji, difficulty, habitat, diet, size,
                 can_fly, can_swim, is_domestic, is_mammal, has_fur, has_tail
"""
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class Animal:
    id: int
    name_ar: str
    emoji: str
    difficulty: str  # easy | medium | hard
    habitat: str     # domestic | land | water | air | desert | jungle | arctic
    diet: str        # herbivore | carnivore | omnivore
    size: str        # small | medium | large | huge
    can_fly: bool = False
    can_swim: bool = False
    is_domestic: bool = False
    is_mammal: bool = False
    has_fur: bool = False
    has_tail: bool = True
    has_horns: bool = False
    lives_in_groups: bool = False
    is_nocturnal: bool = False
    is_african: bool = False


ANIMALS: list[Animal] = [
    # ==================== EASY (15 animals) ====================
    Animal(id=1,  name_ar="قطة",     emoji="🐱", difficulty="easy",
           habitat="domestic", diet="carnivore", size="small",
           is_domestic=True, is_mammal=True, has_fur=True),

    Animal(id=2,  name_ar="كلب",     emoji="🐶", difficulty="easy",
           habitat="domestic", diet="omnivore", size="medium",
           is_domestic=True, is_mammal=True, has_fur=True),

    Animal(id=3,  name_ar="دجاجة",   emoji="🐔", difficulty="easy",
           habitat="domestic", diet="omnivore", size="small",
           can_fly=False, is_domestic=True, has_fur=False, has_tail=False),

    Animal(id=4,  name_ar="أرنب",    emoji="🐰", difficulty="easy",
           habitat="land", diet="herbivore", size="small",
           is_mammal=True, has_fur=True),

    Animal(id=5,  name_ar="بقرة",    emoji="🐄", difficulty="easy",
           habitat="domestic", diet="herbivore", size="large",
           is_domestic=True, is_mammal=True, has_fur=True, has_horns=True),

    Animal(id=6,  name_ar="حصان",    emoji="🐴", difficulty="easy",
           habitat="domestic", diet="herbivore", size="large",
           is_domestic=True, is_mammal=True, has_fur=True),

    Animal(id=7,  name_ar="خروف",    emoji="🐑", difficulty="easy",
           habitat="domestic", diet="herbivore", size="medium",
           is_domestic=True, is_mammal=True, has_fur=True, has_horns=True),

    Animal(id=8,  name_ar="دب",      emoji="🐻", difficulty="easy",
           habitat="land", diet="omnivore", size="large",
           can_swim=True, is_mammal=True, has_fur=True),

    Animal(id=9,  name_ar="بطة",     emoji="🦆", difficulty="easy",
           habitat="water", diet="omnivore", size="small",
           can_fly=True, can_swim=True, has_fur=False, has_tail=True),

    Animal(id=10, name_ar="سمكة",    emoji="🐟", difficulty="easy",
           habitat="water", diet="omnivore", size="small",
           can_swim=True, has_fur=False, has_tail=True),

    Animal(id=11, name_ar="أسد",     emoji="🦁", difficulty="easy",
           habitat="land", diet="carnivore", size="large",
           is_mammal=True, has_fur=True, lives_in_groups=True, is_african=True),

    Animal(id=12, name_ar="فيل",     emoji="🐘", difficulty="easy",
           habitat="land", diet="herbivore", size="huge",
           can_swim=True, is_mammal=True, is_african=True),

    Animal(id=13, name_ar="قرد",     emoji="🐒", difficulty="easy",
           habitat="jungle", diet="omnivore", size="small",
           is_mammal=True, has_fur=True, lives_in_groups=True),

    Animal(id=14, name_ar="ببغاء",   emoji="🦜", difficulty="easy",
           habitat="jungle", diet="herbivore", size="small",
           can_fly=True, has_fur=False, has_tail=True),

    Animal(id=15, name_ar="حمار",    emoji="🫏", difficulty="easy",
           habitat="domestic", diet="herbivore", size="large",
           is_domestic=True, is_mammal=True, has_fur=True),

    # ==================== MEDIUM (25 animals) ====================
    Animal(id=16, name_ar="زرافة",   emoji="🦒", difficulty="medium",
           habitat="land", diet="herbivore", size="huge",
           is_mammal=True, has_fur=True, is_african=True),

    Animal(id=17, name_ar="حمار وحشي", emoji="🦓", difficulty="medium",
           habitat="land", diet="herbivore", size="large",
           is_mammal=True, has_fur=True, is_african=True, lives_in_groups=True),

    Animal(id=18, name_ar="فرس النهر", emoji="🦛", difficulty="medium",
           habitat="water", diet="herbivore", size="huge",
           can_swim=True, is_mammal=True, is_african=True),

    Animal(id=19, name_ar="وحيد القرن", emoji="🦏", difficulty="medium",
           habitat="land", diet="herbivore", size="huge",
           is_mammal=True, has_horns=True, is_african=True),

    Animal(id=20, name_ar="نمر",     emoji="🐯", difficulty="medium",
           habitat="jungle", diet="carnivore", size="large",
           is_mammal=True, has_fur=True),

    Animal(id=21, name_ar="فهد",     emoji="🐆", difficulty="medium",
           habitat="land", diet="carnivore", size="large",
           is_mammal=True, has_fur=True, is_african=True),

    Animal(id=22, name_ar="ذئب",     emoji="🐺", difficulty="medium",
           habitat="land", diet="carnivore", size="large",
           is_mammal=True, has_fur=True, lives_in_groups=True),

    Animal(id=23, name_ar="ثعلب",    emoji="🦊", difficulty="medium",
           habitat="land", diet="omnivore", size="small",
           is_mammal=True, has_fur=True, is_nocturnal=True),

    Animal(id=24, name_ar="دلفين",   emoji="🐬", difficulty="medium",
           habitat="water", diet="carnivore", size="large",
           can_swim=True, is_mammal=True, lives_in_groups=True),

    Animal(id=25, name_ar="حوت",     emoji="🐋", difficulty="medium",
           habitat="water", diet="carnivore", size="huge",
           can_swim=True, is_mammal=True),

    Animal(id=26, name_ar="قرش",     emoji="🦈", difficulty="medium",
           habitat="water", diet="carnivore", size="large",
           can_swim=True, has_fur=False, has_tail=True),

    Animal(id=27, name_ar="أخطبوط",  emoji="🐙", difficulty="medium",
           habitat="water", diet="carnivore", size="medium",
           can_swim=True, has_fur=False, has_tail=False),

    Animal(id=28, name_ar="سلحفاة",  emoji="🐢", difficulty="medium",
           habitat="land", diet="herbivore", size="small",
           can_swim=True, has_fur=False, has_tail=True),

    Animal(id=29, name_ar="ضفدع",    emoji="🐸", difficulty="medium",
           habitat="water", diet="carnivore", size="small",
           can_swim=True, has_fur=False, has_tail=False),

    Animal(id=30, name_ar="عقرب",    emoji="🦂", difficulty="medium",
           habitat="desert", diet="carnivore", size="small",
           has_fur=False, has_tail=True, is_nocturnal=True),

    Animal(id=31, name_ar="نسر",     emoji="🦅", difficulty="medium",
           habitat="land", diet="carnivore", size="large",
           can_fly=True, has_fur=False),

    Animal(id=32, name_ar="طاووس",   emoji="🦚", difficulty="medium",
           habitat="land", diet="omnivore", size="medium",
           can_fly=True, has_fur=False),

    Animal(id=33, name_ar="بومة",    emoji="🦉", difficulty="medium",
           habitat="land", diet="carnivore", size="small",
           can_fly=True, has_fur=False, is_nocturnal=True),

    Animal(id=34, name_ar="حمامة",   emoji="🕊️", difficulty="medium",
           habitat="land", diet="herbivore", size="small",
           can_fly=True, has_fur=False),

    Animal(id=35, name_ar="بجعة",    emoji="🦢", difficulty="medium",
           habitat="water", diet="herbivore", size="large",
           can_fly=True, can_swim=True, has_fur=False),

    Animal(id=36, name_ar="كنغر",    emoji="🦘", difficulty="medium",
           habitat="land", diet="herbivore", size="large",
           is_mammal=True, has_fur=True, lives_in_groups=True),

    Animal(id=37, name_ar="زبابة",   emoji="🦔", difficulty="medium",
           habitat="land", diet="omnivore", size="small",
           is_mammal=True, has_fur=False, is_nocturnal=True),

    Animal(id=38, name_ar="خفاش",    emoji="🦇", difficulty="medium",
           habitat="land", diet="carnivore", size="small",
           can_fly=True, is_mammal=True, has_fur=True, is_nocturnal=True),

    Animal(id=39, name_ar="طاسوع",   emoji="🦫", difficulty="medium",
           habitat="water", diet="herbivore", size="medium",
           can_swim=True, is_mammal=True, has_fur=True),

    Animal(id=40, name_ar="غوريلا",  emoji="🦍", difficulty="medium",
           habitat="jungle", diet="herbivore", size="huge",
           is_mammal=True, has_fur=True, is_african=True),

    # ==================== HARD (20 animals) ====================
    Animal(id=41, name_ar="تمساح",   emoji="🐊", difficulty="hard",
           habitat="water", diet="carnivore", size="large",
           can_swim=True, has_fur=False, has_tail=True, is_african=True),

    Animal(id=42, name_ar="أفعى",    emoji="🐍", difficulty="hard",
           habitat="land", diet="carnivore", size="medium",
           has_fur=False, has_tail=True),

    Animal(id=43, name_ar="عناكب",   emoji="🕷️", difficulty="hard",
           habitat="land", diet="carnivore", size="small",
           has_fur=False, has_tail=False, is_nocturnal=True),

    Animal(id=44, name_ar="قنفذ",    emoji="🦔", difficulty="hard",
           habitat="land", diet="omnivore", size="small",
           is_mammal=True, has_fur=False, is_nocturnal=True),

    Animal(id=45, name_ar="جمل",     emoji="🐪", difficulty="hard",
           habitat="desert", diet="herbivore", size="large",
           is_domestic=True, is_mammal=True, has_fur=True),

    Animal(id=46, name_ar="بعير",    emoji="🐫", difficulty="hard",
           habitat="desert", diet="herbivore", size="large",
           is_mammal=True, has_fur=True),

    Animal(id=47, name_ar="نعامة",   emoji="🦤", difficulty="hard",
           habitat="land", diet="omnivore", size="huge",
           can_fly=False, has_fur=False, is_african=True),

    Animal(id=48, name_ar="طوقان",   emoji="🦜", difficulty="hard",
           habitat="jungle", diet="herbivore", size="small",
           can_fly=True, has_fur=False),

    Animal(id=49, name_ar="أناكوندا", emoji="🐍", difficulty="hard",
           habitat="jungle", diet="carnivore", size="huge",
           can_swim=True, has_fur=False, has_tail=True),

    Animal(id=50, name_ar="وعل",     emoji="🦌", difficulty="hard",
           habitat="land", diet="herbivore", size="large",
           is_mammal=True, has_fur=True, has_horns=True, lives_in_groups=True),

    Animal(id=51, name_ar="ذبابة",   emoji="🪰", difficulty="hard",
           habitat="land", diet="omnivore", size="small",
           can_fly=True, has_fur=False, has_tail=False),

    Animal(id=52, name_ar="ثعبان الأفريقي", emoji="🐍", difficulty="hard",
           habitat="land", diet="carnivore", size="large",
           has_fur=False, has_tail=True, is_african=True),

    Animal(id=53, name_ar="وحيد المرفق", emoji="🐧", difficulty="hard",
           habitat="arctic", diet="carnivore", size="small",
           can_swim=True, has_fur=False),

    Animal(id=54, name_ar="بطريق",   emoji="🐧", difficulty="hard",
           habitat="arctic", diet="carnivore", size="medium",
           can_swim=True, has_fur=False, lives_in_groups=True),

    Animal(id=55, name_ar="فقمة",    emoji="🦭", difficulty="hard",
           habitat="arctic", diet="carnivore", size="large",
           can_swim=True, is_mammal=True, has_fur=True),

    Animal(id=56, name_ar="دب قطبي", emoji="🐻‍❄️", difficulty="hard",
           habitat="arctic", diet="carnivore", size="huge",
           can_swim=True, is_mammal=True, has_fur=True),

    Animal(id=57, name_ar="فراشة",   emoji="🦋", difficulty="hard",
           habitat="land", diet="herbivore", size="small",
           can_fly=True, has_fur=False, has_tail=False),

    Animal(id=58, name_ar="نمل",     emoji="🐜", difficulty="hard",
           habitat="land", diet="omnivore", size="small",
           has_fur=False, has_tail=False, lives_in_groups=True),

    Animal(id=59, name_ar="جراد",    emoji="🦗", difficulty="hard",
           habitat="land", diet="herbivore", size="small",
           can_fly=True, has_fur=False, has_tail=False, lives_in_groups=True),

    Animal(id=60, name_ar="بانيو",   emoji="🦣", difficulty="hard",
           habitat="land", diet="herbivore", size="huge",
           is_mammal=True, has_fur=True),
]

# Quick lookup dicts
ANIMALS_BY_ID: dict[int, Animal] = {a.id: a for a in ANIMALS}
ANIMALS_BY_DIFFICULTY: dict[str, list[Animal]] = {
    "easy": [a for a in ANIMALS if a.difficulty == "easy"],
    "medium": [a for a in ANIMALS if a.difficulty == "medium"],
    "hard": [a for a in ANIMALS if a.difficulty == "hard"],
}


def get_animal(animal_id: int) -> Optional[Animal]:
    return ANIMALS_BY_ID.get(animal_id)


def get_animal_dict(animal_id: int) -> Optional[dict]:
    a = get_animal(animal_id)
    if not a:
        return None
    return {
        "id": a.id,
        "name_ar": a.name_ar,
        "emoji": a.emoji,
        "difficulty": a.difficulty,
    }


def get_all_animals_for_selector() -> list[dict]:
    """Return all animals for client-side animal selector (no secret info)."""
    return [
        {"id": a.id, "name_ar": a.name_ar, "emoji": a.emoji, "difficulty": a.difficulty}
        for a in ANIMALS
    ]
