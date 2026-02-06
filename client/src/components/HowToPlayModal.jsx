import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = {
  he: [
    {
      id: 'join',
      title: 'שלב 1 — הצטרפות לחדר',
      body: [
        'במסך הפתיחה בחר שם שחקן והכנס Room ID קיים, או השאר ריק כדי לפתוח חדר חדש.',
        'שלח את ה‑Room ID לחבר — כשהוא מצטרף, המשחק יתחיל.',
        'אתה תמיד רואה את הכלים שלך בתחתית הלוח, והיריב בחלק העליון.',
      ],
    },
    {
      id: 'setup',
      title: 'שלב 2 — סידור הכלים (Setup)',
      body: [
        'הלוח הוא 6×6. לכל שחקן יש שתי שורות צד שלו בלבד לסידור (שורות תחתונות אצלך, שורות עליונות אצל היריב).',
        'עליך להציב בדיוק 12 יחידות: דגל אחד (🚩), מלכודת אחת (🪤), ועוד 10 יחידות קרב מסוג Rock / Paper / Scissors.',
        'יש טיימר Setup. אם הזמן נגמר לפני שסיימת, המערכת משלימה עבורך את החסר בצורה חכמה.',
      ],
    },
    {
      id: 'turns',
      title: 'שלב 3 — מהלך תור',
      body: [
        'בתורך אתה בוחר יחידת Rock / Paper / Scissors (לא דגל ולא מלכודת) ומזיז אותה צעד אחד למעלה / למטה / שמאלה / ימינה.',
        'אפשר לנוע לריבוע ריק, או לתקוף ריבוע של היריב. יחידות היריב מוסתרות עד שנכנסים לקרב או שהן מתגלות.',
        'יש לך 30 שניות לתור. אם לא זזת בזמן, המערכת בוחרת עבורך מהלך חוקי אקראי ומעבירה את התור.',
      ],
    },
    {
      id: 'combat',
      title: 'שלב 4 — קרב RPS רגיל',
      body: [
        'כאשר אתה נכנס לריבוע של היריב מתבצע קרב אחסן/נייר/מספריים:',
        '🪨 Rock מנצח ✂️ Scissors, ✂️ Scissors מנצח 📄 Paper, 📄 Paper מנצח 🪨 Rock.',
        'אם ניצחת — היחידה שלך עוברת לריבוע של היריב; אם הפסדת — היחידה שלך מוסרת; אם נכנסת למלכודת 🪤 — היחידה שלך נעלמת והמלכודת נשארת.',
      ],
    },
    {
      id: 'tie',
      title: 'שלב 5 — שובר שוויון (Sudden Death)',
      body: [
        'אם שתי היחידות באותו סוג (למשל Rock מול Rock), נפתח מסך Sudden Death.',
        'שניכם בוחרים מחדש Rock / Paper / Scissors במשך 7 שניות. אם מישהו לא בוחר בזמן, המערכת בוחרת בשבילו אקראית.',
        'אם שוב יצא תיקו — מוצג Draw קצר וחוזרים מיד לסיבוב בחירה נוסף עד שיש מנצח ברור.',
      ],
    },
    {
      id: 'win',
      title: 'איך מנצחים?',
      body: [
        'אתה מנצח אם כובשים את הדגל 🚩 של היריב (נכנסים לתא שבו הוא נמצא).',
        'או אם ליריב לא נשארות יחידות Rock / Paper / Scissors שיכולות לזוז על הלוח.',
        'אם היריב עוזב את החדר או מתנתק לאורך זמן – אתה מקבל ניצחון אוטומטי על עזיבה.',
      ],
    },
  ],
  en: [
    {
      id: 'join',
      title: 'Step 1 — Join a Room',
      body: [
        'On the welcome screen choose a player name and enter an existing Room ID, or leave it empty to create a new room.',
        'Share the Room ID with your friend — once both of you are inside, the game begins.',
        'You always see your units at the bottom of the board; your opponent is at the top.',
      ],
    },
    {
      id: 'setup',
      title: 'Step 2 — Setup Your Army',
      body: [
        'The board is 6×6. Each player can place pieces only on their own two back rows (bottom rows for you, top rows for your opponent).',
        'You must place exactly 12 pieces: one Flag (🚩), one Trap (🪤), and ten combat units of Rock / Paper / Scissors in any mix.',
        'There is a setup timer. When it expires, any empty spots are auto-filled for you with a smart layout.',
      ],
    },
    {
      id: 'turns',
      title: 'Step 3 — Taking a Turn',
      body: [
        'On your turn, choose one of your Rock / Paper / Scissors units (not the Flag or Trap) and move it one tile up / down / left / right.',
        'You may move into an empty square or attack an opponent’s square. Enemy pieces stay hidden until they fight or are revealed.',
        'You have 30 seconds per turn. If you do nothing, the server picks a random legal move for you and passes the turn.',
      ],
    },
    {
      id: 'combat',
      title: 'Step 4 — Regular RPS Combat',
      body: [
        'When you move into an enemy square, a Rock–Paper–Scissors battle is resolved:',
        '🪨 Rock beats ✂️ Scissors, ✂️ Scissors beats 📄 Paper, 📄 Paper beats 🪨 Rock.',
        'If you win, your unit moves onto that square; if you lose, your unit is removed; if you step on a Trap 🪤 your unit dies and the trap stays.',
      ],
    },
    {
      id: 'tie',
      title: 'Step 5 — Sudden Death Tie‑Breaker',
      body: [
        'If both units are the same type (e.g. Rock vs Rock), a Sudden Death tie‑breaker starts.',
        'Both players secretly choose Rock / Paper / Scissors within 7 seconds. If a player does not choose, a random option is picked for them.',
        'If it is still a tie, a short Draw is shown and another Sudden Death round immediately starts until there is a clear winner.',
      ],
    },
    {
      id: 'win',
      title: 'How Do You Win?',
      body: [
        'Capture your opponent’s Flag 🚩 by moving onto its square.',
        'Or eliminate all of your opponent’s movable Rock / Paper / Scissors units so they have no legal moves left.',
        'If your opponent leaves the room or disconnects for too long, you are awarded a win by disconnect.',
      ],
    },
  ],
};

export default function HowToPlayModal({ open, onClose }) {
  const [lang, setLang] = useState('he');
  const [index, setIndex] = useState(0);

  const steps = useMemo(() => STEPS[lang] ?? STEPS.he, [lang]);
  const current = steps[index] ?? steps[0];

  const canPrev = index > 0;
  const canNext = index < steps.length - 1;

  if (!open) return null;

  const handleClose = () => {
    setIndex(0);
    onClose?.();
  };

  const dir = lang === 'he' ? 'rtl' : 'ltr';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backdropFilter: 'blur(10px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close how to play"
          className="absolute inset-0 w-full h-full bg-black/40"
        />

        <motion.div
          className="relative w-full max-w-3xl rounded-3xl bg-slate-900/95 border border-white/15 shadow-2xl px-4 py-4 sm:px-6 sm:py-6 flex flex-col gap-4 overflow-hidden"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-400/60 text-lg">
                🎮
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-amber-300">
                  {lang === 'he' ? 'איך משחקים?' : 'How to Play'}
                </span>
                <span className="text-[11px] text-white/60">
                  {lang === 'he'
                    ? 'גלול עם החצים בין השלבים'
                    : 'Use the arrows to move between steps'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLang('he')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  lang === 'he'
                    ? 'bg-amber-400 text-slate-900 border-amber-300'
                    : 'bg-white/5 text-white/80 border-white/20'
                }`}
              >
                עברית
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  lang === 'en'
                    ? 'bg-amber-400 text-slate-900 border-amber-300'
                    : 'bg-white/5 text-white/80 border-white/20'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="ml-1 h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/20 text-white/80 text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-stretch justify-between gap-3">
            <button
              type="button"
              onClick={() => canPrev && setIndex((i) => Math.max(0, i - 1))}
              disabled={!canPrev}
              className="hidden sm:flex items-center justify-center w-9 h-24 self-center rounded-2xl border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
            >
              {dir === 'rtl' ? '▶' : '◀'}
            </button>

            <div
              className="flex-1 min-w-0 rounded-2xl bg-slate-800/80 border border-white/10 px-4 py-4 sm:px-5 sm:py-5 overflow-hidden"
              dir={dir}
            >
              <motion.div
                key={current.id}
                initial={{ x: dir === 'rtl' ? 40 : -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: dir === 'rtl' ? -40 : 40, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-3"
              >
                <h2 className="text-base sm:text-lg font-bold text-amber-300">
                  {current.title}
                </h2>
                <ul className="space-y-2 text-xs sm:text-sm leading-relaxed text-white/80">
                  {current.body.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="mt-0.5 text-amber-400 text-[9px]">◆</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            <button
              type="button"
              onClick={() => canNext && setIndex((i) => Math.min(steps.length - 1, i + 1))}
              disabled={!canNext}
              className="hidden sm:flex items-center justify-center w-9 h-24 self-center rounded-2xl border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
            >
              {dir === 'rtl' ? '◀' : '▶'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 mt-1">
            <div className="flex items-center gap-1">
              {steps.map((step, i) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-5 bg-amber-400' : 'w-2 bg-white/25 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => (canNext ? setIndex((i) => Math.min(steps.length - 1, i + 1)) : handleClose())}
              className="px-3 py-1.5 rounded-full bg-amber-400 text-slate-900 text-xs font-semibold hover:bg-amber-300 transition-colors"
            >
              {canNext
                ? lang === 'he'
                  ? 'הבא ⟶'
                  : 'Next ⟶'
                : lang === 'he'
                  ? 'סגור'
                  : 'Close'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

