// Important answer words a child must say for the reading to count: in a long sentence a wrong noun or
// name ("They come from Japan." for "...Italy.") would otherwise still reach the 70% word threshold.
// Built by hand from the published question bank: nouns as used in its answers (plural forms that
// appear there included), weekdays, months, and person / place names. Function words, numbers,
// adjectives, adverbs and words that are mainly verbs (play, help, like, need, watch...) are left out;
// unclear noun/verb words are left out too, so a correct reading is never failed by this list.
// Heard spellings ("colour", "Shawn") are mapped onto the answer's spelling before this check.
export const KEY_NOUNS = new Set([
    "action", "activity", "age", "air", "airplanes", "airport", "alan", "alex", "alien", "america", "angel",
    "animals", "ann", "anna", "ants", "apartment", "apple", "appointment", "april", "area", "arm", "arms",
    "art", "atm", "attention", "august", "aunt", "aunts", "australia", "autobike", "autumn", "baby", "bacon",
    "badminton", "bag", "bags", "ball", "balls", "banana", "bananas", "band", "bands", "bank", "barbecue",
    "baseball", "basket", "basketball", "bath", "bathroom", "bathrooms", "beach", "beans", "bear", "bears",
    "bed", "bedroom", "bedrooms", "beef", "beer", "ben", "bench", "benefits", "berry", "betty", "bicycle",
    "bicycles", "bike", "bill", "bird", "birds", "birth", "birthday", "blanket", "blocks", "boats", "body",
    "book", "bookcase", "books", "bookstore", "bookworm", "bottle", "bottles", "bottom", "bowl", "bowling",
    "bowls", "box", "boxes", "boy", "boyfriend", "boys", "bread", "break", "breakfast", "breath", "brim",
    "broom", "brother", "brothers", "budget", "buffet", "building", "buns", "bus", "buses", "business",
    "butter", "cabinet", "cage", "cake", "camel", "camera", "cameras", "camping", "car", "card", "carpets",
    "carrots", "cars", "case", "cash", "cat", "cats", "cello", "center", "centimeters", "chair", "chairs",
    "chance", "cheese", "chef", "chicken", "child", "children", "china", "chocolate", "chopsticks", "chore",
    "chores", "cigarettes", "cindy", "cities", "city", "class", "classmate", "classmates", "classroom",
    "classrooms", "clocks", "closet", "clothing", "cloud", "clouds", "coast", "cockroaches", "coffee", "coke",
    "color", "computer", "computers", "concert", "copycat", "corner", "couch", "countries", "course",
    "cousin", "cousins", "cover", "cow", "cpu", "cream", "credit", "crocodiles", "cup", "cups", "curtain",
    "dad", "daisy", "dancing", "dates", "daughter", "david", "day", "days", "death", "december", "degrees",
    "desert", "desk", "desks", "dessert", "dictionary", "difficulty", "dinner", "direction", "dish", "dishes",
    "ditch", "diving", "doctor", "dodgeball", "dog", "dogs", "doll", "dollars", "dolls", "donuts", "door",
    "drawer", "dream", "dreams", "drum", "duck", "dumbbells", "ear", "ears", "earth", "east", "egg",
    "eggplant", "eggs", "elephant", "elephants", "elevator", "emma", "end", "engineer", "england", "english",
    "eraser", "erasers", "evening", "exam", "excuses", "exercise", "eye", "eyes", "face", "family", "father",
    "fault", "favor", "fear", "february", "fever", "fingers", "fire", "fish", "flavor", "floor", "flour",
    "flower", "flowers", "flute", "fog", "food", "foods", "fool", "football", "footbridge", "forest", "fork",
    "fox", "france", "fred", "friday", "fridge", "friend", "friends", "frog", "fruit", "fruits", "future",
    "game", "games", "gap", "garbage", "garden", "gas", "geese", "genes", "genius", "germany", "gift",
    "giraffe", "giraffes", "girl", "girlfriend", "glass", "glasses", "goats", "goose", "grade", "grades",
    "grandma", "grandpa", "grandparents", "grass", "grocery", "ground", "group", "guest", "guests", "guitar",
    "habit", "hair", "hamburger", "hamburgers", "hand", "handball", "hands", "harry", "hat", "head", "health",
    "heart", "height", "helen", "hiking", "history", "hobbies", "hobby", "hole", "homework", "honey", "horse",
    "hospital", "hour", "hours", "house", "houses", "hug", "human", "humans", "husband", "ice", "idea",
    "insects", "intersection", "ipad", "iphone", "island", "italy", "jack", "jacket", "jackpot", "jam",
    "jane", "january", "japan", "jason", "jeff", "jenny", "jesus", "jill", "jim", "job", "jogging", "john",
    "joseph", "judy", "juice", "june", "jungle", "kangaroos", "keelung", "kenny", "key", "keys", "kilometers",
    "kindergarten", "king", "kitchen", "kittens", "knee", "knife", "korea", "la", "lamp", "law", "lawyers",
    "leader", "leaves", "legs", "lemon", "lesson", "letters", "liar", "library", "lice", "life", "line",
    "lion", "lions", "listener", "livingroom", "loaf", "loaves", "lollipop", "lottery", "louisa", "louse",
    "lucy", "luggage", "lunch", "lungs", "machine", "makeup", "man", "mandy", "marker", "market", "mars",
    "mary", "mat", "math", "meal", "meat", "meter", "meters", "mice", "michael", "midnight", "mike", "milk",
    "minute", "minutes", "mirror", "mirrors", "mistake", "mistakes", "model", "mole", "mom", "moment",
    "monaco", "monday", "money", "monkeys", "month", "months", "moon", "morning", "mother", "motorbike",
    "motorcycle", "motorcycles", "mountain", "mountains", "mouse", "mouth", "movie", "movies", "mum", "music",
    "mutton", "name", "nap", "neck", "neighbor", "neighbors", "nerves", "nest", "news", "nick", "night",
    "noise", "noodle", "noodles", "north", "nose", "novel", "number", "nurse", "octopus", "office", "officer",
    "oil", "onion", "onions", "oolong", "opener", "orange", "oranges", "ox", "oxen", "oysters", "pajamas",
    "palace", "pandemic", "paper", "parents", "park", "party", "passport", "pasta", "paul", "peach", "pen",
    "pencil", "pencils", "pens", "people", "person", "pet", "peter", "pets", "phone", "phones", "photo",
    "piano", "pickpockets", "picture", "pictures", "piece", "pill", "pizza", "place", "plan", "plane",
    "plants", "plates", "pocket", "police", "pond", "pork", "post", "pot", "pounds", "poverty", "prairie",
    "present", "presents", "problem", "progress", "project", "purse", "quality", "queen", "question",
    "questions", "rabbits", "raccoon", "race", "rain", "rap", "reason", "refrigerator", "relatives", "rest",
    "rice", "river", "road", "robert", "robot", "rome", "roof", "room", "rosa", "roundabout", "row", "rubber",
    "rug", "ruler", "rulers", "rules", "sally", "salt", "sandwich", "sandwiches", "sara", "sarah", "saturday",
    "sauce", "sausage", "scenery", "school", "schoolbag", "score", "sea", "sean", "season", "seasons", "seat",
    "seatbelt", "selfies", "september", "sharks", "sheep", "shelf", "shirt", "shoe", "shoes", "shop",
    "shoulders", "side", "sister", "sisters", "skies", "skiing", "skirt", "sky", "smile", "snail", "snake",
    "snakes", "sneakers", "soccer", "socks", "soda", "sofa", "son", "soup", "south", "speaker", "specialty",
    "speech", "spiders", "spoon", "sports", "square", "stage", "stairs", "stapler", "station", "step",
    "steps", "store", "storm", "story", "stranger", "strawberries", "street", "student", "students", "style",
    "subject", "success", "sue", "sugar", "summer", "sun", "sunday", "sunset", "support", "surfing",
    "surname", "susan", "swimming", "table", "tables", "taipei", "taiwan", "taxi", "tea", "teacher", "team",
    "tears", "teddy", "teeth", "television", "temper", "temperature", "tennis", "test", "thief",
    "thunderstorm", "thursday", "tigers", "time", "times", "tina", "toast", "today", "tokyo", "tom",
    "tomatoes", "tomorrow", "tongue", "tonight", "tony", "tooth", "toothpick", "top", "topic", "tour", "toy",
    "toys", "traffic", "train", "tree", "trees", "tricks", "trip", "trouble", "truck", "trucks", "trumpet",
    "tuesday", "tunnel", "tv", "twin", "umbrella", "uncle", "uncles", "university", "vacation", "vase",
    "vegan", "vegetables", "vicky", "video", "view", "violin", "visibility", "visitor", "vitamin", "voice",
    "waiter", "wall", "wallet", "warning", "water", "waterfall", "watermelon", "way", "weather", "wednesday",
    "week", "wendy", "west", "whistle", "width", "wifi", "william", "wind", "window", "winter", "witch",
    "wood", "word", "words", "world", "xylophone", "yaks", "year", "years", "yesterday", "yilan", "zebras",
    "zoo"
]);

// Capitalized words that are not names: a capital in the middle of a sentence marks a name or place
// only when the word is not one of these.
const NOT_NAMES = new Set([
    "a", "an", "the", "i", "me", "my", "mine", "you", "your", "yours", "he", "him", "his", "she", "her", "hers",
    "it", "its", "we", "us", "our", "ours", "they", "them", "their", "theirs", "this", "that", "these", "those",
    "what", "who", "whose", "where", "when", "why", "how", "which", "and", "or", "but", "so", "if", "because",
    "yes", "no", "not", "ok", "okay", "oh", "ow", "all", "up", "down", "in", "on", "at", "to", "of", "for", "with",
    "is", "am", "are", "was", "were", "be", "do", "does", "did", "can", "will", "would", "could", "should",
    "must", "let", "please", "thanks", "thank", "mr", "mrs", "ms", "st", "one", "two", "three", "four", "five",
    "six", "seven", "eight", "nine", "ten", "neither", "either", "both", "too", "also", "here", "there"
]);
const SENTENCE_START = /(^|[.!?。！？:])$/;

// Lowercase answer words (as both scorers tokenize them) that must be heard: KEY_NOUNS, plus a word
// capitalized in the middle of a sentence (a name or place the list does not know, such as "Zelda's").
export const keyWordsOf = (answerText: unknown): string[] => {
    const text = String(answerText || "").replace(/[’‘]/g, "'");
    const keys: string[] = [];
    for (const match of text.matchAll(/[A-Za-z]+(?:'[A-Za-z]+)*/g)) {
        const raw = match[0];
        const word = raw.toLowerCase();
        const base = word.split("'")[0];
        let isKey = KEY_NOUNS.has(base);
        if (!isKey && /^[A-Z]/.test(raw) && base.length > 1 && !NOT_NAMES.has(base)) {
            const before = text.slice(0, match.index).replace(/[\s"'“”()（）\[\]［］/／,-]+$/, "");
            isKey = !SENTENCE_START.test(before);
        }
        if (isKey && !keys.includes(word)) keys.push(word);
    }
    return keys;
};

// A key noun counts as heard in its regular singular or plural (cat/cats, box/boxes, baby/babies) and
// with or without a possessive 's. Irregular plurals (mouse/mice, tooth/teeth) must match exactly.
const bareWord = (word: string) => word.replace(/'s$|'$/, "");
const regularPlurals = (word: string) => [word + "s", word + "es", ...(/[^aeiou]y$/.test(word) ? [word.slice(0, -1) + "ies"] : [])];
const sameNoun = (left: string, right: string) => (
    left === right || regularPlurals(left).includes(right) || regularPlurals(right).includes(left)
);

// Key words of the answer that are missing from the (already aligned) heard words.
export const missingKeyWords = (answerText: unknown, alignedSpoken: string[]): string[] => {
    const heard = alignedSpoken.map(bareWord);
    return keyWordsOf(answerText).filter(key => !heard.some(word => sameNoun(bareWord(key), word)));
};
