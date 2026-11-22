export type CompetitionSeed = {
  slug: string;
  name: string;
  subject: string;
  level: string;
  description: string;
  available: boolean;
  format: Record<string, unknown>;
};

export type QuestionSeed = {
  id: string;
  type: 'single_choice' | 'number';
  prompt: string;
  choices?: { value: string; label: string }[];
  answer: string;
  hint: string;
  explanation: string;
  difficulty: number;
  objective: string;
};

export type LessonSeed = {
  id: string;
  title: string;
  summary: string;
  difficulty: number;
  minutes: number;
  objectives: string[];
  body: {
    introduction: string;
    explanation: string[];
    keyIdea: string;
    example: { prompt: string; steps: string[]; answer: string };
    explorer: {
      kind: 'remainder' | 'equation' | 'percent' | 'area' | 'counting';
      title: string;
      prompt: string;
      defaults: Record<string, number>;
    };
    takeaway: string;
  };
  questions: [QuestionSeed, QuestionSeed];
};

export type UnitSeed = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  icon: string;
  minutes: number;
  lessons: LessonSeed[];
};

export const competitions: CompetitionSeed[] = [
  { slug: 'amc-8', name: 'AMC 8', subject: 'Mathematics', level: 'Middle school', description: 'A mathematics problem-solving pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multiple_choice'] } },
  { slug: 'amc-10', name: 'AMC 10', subject: 'Mathematics', level: 'High school', description: 'An original, structured mathematics journey for AMC 10-style problem solving. Sample content is not official competition material.', available: true, format: { questionTypes: ['multiple_choice', 'number'], curriculum: 'original-sample' } },
  { slug: 'amc-12', name: 'AMC 12', subject: 'Mathematics', level: 'High school', description: 'A mathematics problem-solving pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multiple_choice'] } },
  { slug: 'aime', name: 'AIME', subject: 'Mathematics', level: 'Advanced', description: 'An advanced mathematics pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['integer'] } },
  { slug: 'usamo', name: 'USAMO', subject: 'Mathematics', level: 'Olympiad', description: 'A proof-based mathematics pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['proof'] } },
  { slug: 'usajmo', name: 'USAJMO', subject: 'Mathematics', level: 'Olympiad', description: 'A proof-based mathematics pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['proof'] } },
  { slug: 'f-ma', name: 'F=ma', subject: 'Physics', level: 'High school', description: 'A mechanics-focused physics pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multiple_choice', 'calculation'] } },
  { slug: 'usapho', name: 'USAPhO', subject: 'Physics', level: 'Olympiad', description: 'A physics olympiad pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['short_answer', 'proof'] } },
  { slug: 'usa-physics-team', name: 'USA Physics Team', subject: 'Physics', level: 'Advanced', description: 'A national-team preparation pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multi_step'] } },
  { slug: 'usnco-local', name: 'USNCO Local Exam', subject: 'Chemistry', level: 'High school', description: 'A chemistry olympiad pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multiple_choice', 'equations'] } },
  { slug: 'usnco-national', name: 'USNCO National Exam', subject: 'Chemistry', level: 'Advanced', description: 'A chemistry olympiad pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multiple_choice', 'short_answer'] } },
  { slug: 'usnco-study-camp', name: 'USNCO Study Camp', subject: 'Chemistry', level: 'Advanced', description: 'A chemistry study-camp pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multi_step'] } },
  { slug: 'usabo-open', name: 'USABO Open Exam', subject: 'Biology', level: 'High school', description: 'A biology olympiad pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multiple_choice'] } },
  { slug: 'usabo-semifinal', name: 'USABO Semifinal Exam', subject: 'Biology', level: 'Advanced', description: 'A biology olympiad pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multiple_choice', 'short_answer'] } },
  { slug: 'usabo-national-finals', name: 'USABO National Finals', subject: 'Biology', level: 'Advanced', description: 'A biology national-finals pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['multi_step'] } },
  { slug: 'usaco-bronze', name: 'USACO Bronze', subject: 'Computer Science', level: 'Bronze', description: 'A programming problem-solving pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['programming'] } },
  { slug: 'usaco-silver', name: 'USACO Silver', subject: 'Computer Science', level: 'Silver', description: 'A programming problem-solving pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['programming'] } },
  { slug: 'usaco-gold', name: 'USACO Gold', subject: 'Computer Science', level: 'Gold', description: 'A programming problem-solving pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['programming'] } },
  { slug: 'usaco-platinum', name: 'USACO Platinum', subject: 'Computer Science', level: 'Platinum', description: 'A programming problem-solving pathway. Curriculum content is being prepared.', available: false, format: { questionTypes: ['programming'] } },
];

export const units: UnitSeed[] = [
  {
    id: 'number-theory', title: 'Number theory', shortTitle: 'Number theory', description: 'Find structure in integers, factors, and remainders.', color: '#c8794f', icon: 'hash', minutes: 32,
    lessons: [
      {
        id: 'nt-remainders', title: 'Remainders & modular thinking', summary: 'Spot repeating patterns instead of calculating enormous powers.', difficulty: 1, minutes: 8,
        objectives: ['Read and use congruence notation', 'Find repeating patterns in powers', 'Reduce a large calculation modulo an integer'],
        body: {
          introduction: 'A remainder is more than what is left over. It is a compact way to describe how numbers behave in cycles — one of the most useful tools for turning a huge expression into a small one.',
          explanation: ['We write a ≡ b (mod m) when a and b leave the same remainder after division by m. For example, 17 ≡ 2 (mod 5).', 'Congruences let us replace a number with a simpler one while keeping the remainder pattern. If 3² ≡ 1 (mod 8), then every even power of 3 is also congruent to 1 modulo 8.', 'For addition and multiplication, you can reduce each part before calculating: (a + b) mod m and (a × b) mod m depend only on the remainders of a and b.'],
          keyIdea: 'Keep the remainder, not the whole number.',
          example: { prompt: 'Find the remainder when 3²⁰ is divided by 8.', steps: ['Notice 3² = 9 ≡ 1 (mod 8).', 'Group the exponent into ten pairs: 3²⁰ = (3²)¹⁰.', 'Replace each pair with its remainder: 1¹⁰ ≡ 1 (mod 8).'], answer: 'The remainder is 1.' },
          explorer: { kind: 'remainder', title: 'Remainder explorer', prompt: 'Change the number and divisor to see the division identity in action.', defaults: { number: 23, divisor: 5 } },
          takeaway: 'Look for a short cycle before you multiply large powers.'
        },
        questions: [
          { id: 'q-nt-rem-1', type: 'single_choice', prompt: 'What is the remainder when 3²⁰ is divided by 8?', choices: [{ value: 'A', label: '0' }, { value: 'B', label: '1' }, { value: 'C', label: '3' }, { value: 'D', label: '5' }], answer: 'B', hint: 'Try computing 3² modulo 8, then group the exponent into pairs.', explanation: 'Since 3² = 9 ≡ 1 (mod 8), we have 3²⁰ = (3²)¹⁰ ≡ 1¹⁰ ≡ 1 (mod 8).', difficulty: 2, objective: 'Power cycles' },
          { id: 'q-nt-rem-2', type: 'number', prompt: 'What remainder does 12,345 leave when divided by 9?', answer: '6', hint: 'The sum of the decimal digits gives the same remainder modulo 9.', explanation: 'The digit sum is 1 + 2 + 3 + 4 + 5 = 15, and 15 leaves remainder 6 when divided by 9.', difficulty: 1, objective: 'Remainders and digit sums' }
        ]
      },
      {
        id: 'nt-divisibility', title: 'Divisibility, GCD & LCM', summary: 'Use shared factors and multiples to simplify integer problems.', difficulty: 2, minutes: 9,
        objectives: ['Find a greatest common divisor with prime factors', 'Use the least common multiple to count shared multiples', 'Recognize divisibility structure'],
        body: {
          introduction: 'When two quantities repeat or share structure, the greatest common divisor and least common multiple describe that relationship cleanly.',
          explanation: ['The greatest common divisor (GCD) is the largest integer that divides both numbers. The least common multiple (LCM) is the smallest positive integer that both numbers divide.', 'Prime factorization makes both visible. For the GCD, keep the shared prime factors with the smaller exponents. For the LCM, keep every prime factor with the larger exponents.', 'A number divisible by both a and b is divisible by lcm(a, b), so counting common multiples often becomes one division.'],
          keyIdea: 'GCD keeps the overlap; LCM covers everything needed.',
          example: { prompt: 'How many integers from 1 through 100 are divisible by both 4 and 6?', steps: ['A shared multiple must be a multiple of lcm(4, 6).', 'Since lcm(4, 6) = 12, count the multiples of 12 up to 100.', 'There are ⌊100 ÷ 12⌋ = 8 such integers.'], answer: 'There are 8.' },
          explorer: { kind: 'counting', title: 'Shared multiples', prompt: 'Adjust the interval and the shared step to count how many multiples fit.', defaults: { choices: 100, options: 12 } },
          takeaway: 'Translate “divisible by both” into a multiple of the LCM.'
        },
        questions: [
          { id: 'q-nt-gcd-1', type: 'single_choice', prompt: 'How many integers from 1 through 100 are divisible by both 4 and 6?', choices: [{ value: 'A', label: '6' }, { value: 'B', label: '8' }, { value: 'C', label: '12' }, { value: 'D', label: '16' }], answer: 'B', hint: 'First find the least common multiple of 4 and 6. Then count its multiples up to 100.', explanation: 'The LCM of 4 and 6 is 12. The multiples are 12, 24, …, 96, giving ⌊100/12⌋ = 8.', difficulty: 2, objective: 'LCM and counting' },
          { id: 'q-nt-gcd-2', type: 'number', prompt: 'What is the greatest common divisor of 84 and 126?', answer: '42', hint: 'Write each number as a product of primes, or use the Euclidean algorithm.', explanation: '84 = 2² × 3 × 7 and 126 = 2 × 3² × 7. Their shared factors with the smaller exponents multiply to 2 × 3 × 7 = 42.', difficulty: 2, objective: 'Greatest common divisor' }
        ]
      },
      {
        id: 'nt-prime-factors', title: 'Prime factors & powers', summary: 'Break integers into prime building blocks and read their patterns.', difficulty: 2, minutes: 8,
        objectives: ['Write a prime factorization', 'Count distinct prime factors', 'Use the exponent of a prime to reason about factorials'],
        body: {
          introduction: 'Prime numbers are the atoms of whole-number arithmetic. Once a number is factored into primes, divisibility and repeated factors become much easier to see.',
          explanation: ['Every integer greater than 1 has a unique prime factorization, apart from the order of the factors.', 'The exponent tells you how many copies of that prime are present. Distinct prime factors count different primes, not copies.', 'In n!, the exponent of a prime p is ⌊n/p⌋ + ⌊n/p²⌋ + ⌊n/p³⌋ + ⋯. Each term counts another layer of multiples of p.'],
          keyIdea: 'Factor first; count copies only when the question asks for them.',
          example: { prompt: 'How many trailing zeroes does 10! have?', steps: ['A trailing zero needs a factor of 10 = 2 × 5.', 'Factorials contain more 2s than 5s, so count the factors of 5.', 'There are ⌊10/5⌋ = 2 multiples of 5 and no multiples of 25.'], answer: '10! has 2 trailing zeroes.' },
          explorer: { kind: 'counting', title: 'Prime layers in a factorial', prompt: 'Move the slider to see how multiples of a prime appear in a factorial.', defaults: { choices: 10, options: 5 } },
          takeaway: 'For trailing zeroes, count the less common factor — usually the 5s.'
        },
        questions: [
          { id: 'q-nt-prime-1', type: 'number', prompt: 'How many distinct prime factors does 2³ × 3² × 5 have?', answer: '3', hint: 'Distinct means count each different prime once, regardless of its exponent.', explanation: 'The different primes are 2, 3, and 5, so there are 3 distinct prime factors.', difficulty: 1, objective: 'Prime factorization' },
          { id: 'q-nt-prime-2', type: 'number', prompt: 'How many trailing zeroes does 10! have?', answer: '2', hint: 'A trailing zero uses one factor of 2 and one factor of 5. Count the 5s in 10!.', explanation: 'There are ⌊10/5⌋ = 2 factors of 5 and no extra factor from 25, so 10! ends in 2 zeroes.', difficulty: 2, objective: 'Prime exponents in factorials' }
        ]
      }
    ]
  },
  {
    id: 'algebra', title: 'Algebra', shortTitle: 'Algebra', description: 'Turn relationships into equations and notice useful structure.', color: '#5f8a80', icon: 'sigma', minutes: 31,
    lessons: [
      {
        id: 'alg-linear-equations', title: 'Equations & balance', summary: 'Solve linear equations by keeping both sides in balance.', difficulty: 1, minutes: 8,
        objectives: ['Use inverse operations', 'Keep an equation balanced', 'Check a solution in the original equation'],
        body: {
          introduction: 'An equation is a balance. Whatever operation you perform on one side, perform on the other to keep the equality true.',
          explanation: ['To isolate a variable, undo operations in reverse order. Addition is undone by subtraction; multiplication is undone by division.', 'For 3x + 5 = 26, first subtract 5 from both sides, then divide both sides by 3.', 'Substitution is the final check: a proposed value should make the original left and right sides equal.'],
          keyIdea: 'Whatever you do to one side, do to the other.',
          example: { prompt: 'Solve 3x + 5 = 26.', steps: ['Subtract 5 from both sides: 3x = 21.', 'Divide both sides by 3: x = 7.', 'Check: 3(7) + 5 = 26.'], answer: 'x = 7.' },
          explorer: { kind: 'equation', title: 'Balance the equation', prompt: 'Change the total and the fixed amount. The variable term adjusts to keep the equation balanced.', defaults: { number: 26, divisor: 5 } },
          takeaway: 'Reverse the operations, one balanced step at a time.'
        },
        questions: [
          { id: 'q-alg-linear-1', type: 'number', prompt: 'Solve 3x + 5 = 2x + 12. What is x?', answer: '7', hint: 'Move the x terms to one side and the constants to the other.', explanation: 'Subtract 2x from both sides to get x + 5 = 12. Subtract 5, so x = 7.', difficulty: 1, objective: 'Linear equations' },
          { id: 'q-alg-linear-2', type: 'number', prompt: 'If 2y − 3 = 15, what is y?', answer: '9', hint: 'Undo the subtraction first, then undo multiplication by 2.', explanation: 'Add 3 to both sides: 2y = 18. Divide by 2 to get y = 9.', difficulty: 1, objective: 'Inverse operations' }
        ]
      },
      {
        id: 'alg-ratios', title: 'Ratios & percentages', summary: 'Scale quantities without losing the relationship between them.', difficulty: 2, minutes: 8,
        objectives: ['Scale a ratio to a total', 'Calculate a percentage change', 'Translate a verbal relationship into a proportion'],
        body: {
          introduction: 'Ratios describe relative size. Scaling every part by the same factor preserves the relationship, which makes ratios a natural tool for many contest problems.',
          explanation: ['A ratio 3:5 has 8 total parts. If the actual total is 40, each part is 40 ÷ 8 = 5.', 'A percent is a ratio out of 100. A 15% decrease keeps 85% of the original amount.', 'When a quantity changes by a percent, multiply by the remaining or new fraction rather than subtracting a raw percentage point.'],
          keyIdea: 'Find the scale factor, then apply it to every part.',
          example: { prompt: 'A $80 item is reduced by 15%. What is its new price?', steps: ['A 15% reduction leaves 100% − 15% = 85%.', 'Convert 85% to 0.85.', 'Multiply: 80 × 0.85 = 68.'], answer: 'The new price is $68.' },
          explorer: { kind: 'percent', title: 'Percent change explorer', prompt: 'Adjust the discount to see how much remains from an $80 starting amount.', defaults: { number: 80, divisor: 15 } },
          takeaway: 'A percent change is multiplication by a scale factor.'
        },
        questions: [
          { id: 'q-alg-ratio-1', type: 'number', prompt: 'A $80 item is discounted by 15%. What is the new price in dollars?', answer: '68', hint: 'After a 15% decrease, what percent of the original price remains?', explanation: 'The sale price is 85% of $80, so 0.85 × 80 = $68.', difficulty: 2, objective: 'Percent decrease' },
          { id: 'q-alg-ratio-2', type: 'number', prompt: 'Two quantities are in the ratio 3:5 and add to 40. What is the smaller quantity?', answer: '15', hint: 'There are 3 + 5 total ratio parts. Find the value of one part first.', explanation: 'The 8 equal parts total 40, so each part is 5. The smaller quantity is 3 × 5 = 15.', difficulty: 1, objective: 'Scaling ratios' }
        ]
      },
      {
        id: 'alg-quadratic-patterns', title: 'Quadratic patterns', summary: 'Use factoring and identities to simplify expressions with squares.', difficulty: 3, minutes: 9,
        objectives: ['Recognize a difference of squares', 'Apply a symmetric identity', 'Use a substitution to reduce repeated expressions'],
        body: {
          introduction: 'Quadratic expressions often look complicated only because the same structure is written in a long form. Factoring and identities make that structure visible.',
          explanation: ['The difference of squares factors as a² − b² = (a − b)(a + b).', 'If x + 1/x = k, squaring both sides gives x² + 2 + 1/x² = k².', 'Keep expressions grouped until the useful identity appears. Expanding too early can hide the pattern.'],
          keyIdea: 'Look for a familiar identity before expanding.',
          example: { prompt: 'If x + 1/x = 3, find x² + 1/x².', steps: ['Square both sides: (x + 1/x)² = 3² = 9.', 'Expand the left side: x² + 2 + 1/x² = 9.', 'Subtract 2 from both sides.'], answer: 'x² + 1/x² = 7.' },
          explorer: { kind: 'equation', title: 'Undo a square', prompt: 'See how a square can turn a sum into a useful identity.', defaults: { number: 3, divisor: 2 } },
          takeaway: 'Use identities to preserve structure, not just to shorten a line.'
        },
        questions: [
          { id: 'q-alg-quad-1', type: 'number', prompt: 'What is the positive solution of x² − 9 = 0?', answer: '3', hint: 'Factor the difference of squares into two linear factors.', explanation: 'x² − 9 = (x − 3)(x + 3), so x = 3 or x = −3. The positive solution is 3.', difficulty: 1, objective: 'Difference of squares' },
          { id: 'q-alg-quad-2', type: 'number', prompt: 'If x + 1/x = 3, what is x² + 1/x²?', answer: '7', hint: 'Square the given expression. Remember the middle term is 2.', explanation: 'Squaring gives x² + 2 + 1/x² = 9, so x² + 1/x² = 7.', difficulty: 3, objective: 'Symmetric identities' }
        ]
      }
    ]
  },
  {
    id: 'geometry', title: 'Geometry', shortTitle: 'Geometry', description: 'Use angle, area, and distance relationships to reveal hidden structure.', color: '#6c7fac', icon: 'triangle', minutes: 32,
    lessons: [
      {
        id: 'geo-angle-chasing', title: 'Angle relationships', summary: 'Build an angle argument from a few reliable facts.', difficulty: 1, minutes: 8,
        objectives: ['Use the angle sum of a triangle', 'Identify supplementary angles', 'Write a short chain of angle equalities'],
        body: {
          introduction: 'A geometry diagram may contain many lines, but only a few angle facts are needed to unlock it. Start with dependable relationships and keep a clear chain of reasoning.',
          explanation: ['The interior angles of every triangle add to 180°.', 'Angles on a straight line are supplementary, so their measures add to 180°.', 'Vertically opposite angles are equal. Marking equal angles in a sketch often exposes a hidden isosceles triangle.'],
          keyIdea: 'Write down the known angle relationships before guessing from the picture.',
          example: { prompt: 'A triangle has angles 35° and 65°. Find its third angle.', steps: ['The three interior angles add to 180°.', 'Add the known angles: 35° + 65° = 100°.', 'Subtract from 180°: 180° − 100° = 80°.'], answer: 'The third angle is 80°.' },
          explorer: { kind: 'area', title: 'Triangle angle sum', prompt: 'Change two angles and see the remaining angle needed to complete a triangle.', defaults: { number: 35, divisor: 65 } },
          takeaway: 'A diagram is a map of relationships — not a source of measured values.'
        },
        questions: [
          { id: 'q-geo-angle-1', type: 'number', prompt: 'A triangle has angles 35° and 65°. What is its third angle in degrees?', answer: '80', hint: 'The interior angles of a triangle add to 180°.', explanation: '180° − 35° − 65° = 80°.', difficulty: 1, objective: 'Triangle angle sum' },
          { id: 'q-geo-angle-2', type: 'number', prompt: 'Two angles of a triangle are 42° and 58°. What is the third angle?', answer: '80', hint: 'Subtract the sum of the known angles from 180°.', explanation: 'The known angles sum to 100°, leaving 180° − 100° = 80°.', difficulty: 1, objective: 'Angle relationships' }
        ]
      },
      {
        id: 'geo-area-similarity', title: 'Area & similarity', summary: 'Track how lengths and areas change when figures are scaled.', difficulty: 2, minutes: 8,
        objectives: ['Identify a linear scale factor', 'Square a scale factor for area', 'Calculate triangle area from base and height'],
        body: {
          introduction: 'Similar figures have the same shape but may differ in size. The scale factor for lengths is not the scale factor for area — that distinction is easy to miss.',
          explanation: ['If corresponding side lengths scale by k, every length scales by k.', 'Area uses two dimensions, so a similarity scale factor k changes area by k².', 'For a triangle, area = ½ × base × perpendicular height. The height must meet the chosen base at a right angle.'],
          keyIdea: 'Length scales by k; area scales by k².',
          example: { prompt: 'A similar figure is enlarged by a factor of 3. By what factor does its area change?', steps: ['The linear scale factor is k = 3.', 'Area scales by the square of the length factor.', 'Compute 3² = 9.'], answer: 'The area is multiplied by 9.' },
          explorer: { kind: 'area', title: 'Scale factor explorer', prompt: 'Adjust the length scale factor and compare the area multiplier.', defaults: { number: 3, divisor: 6 } },
          takeaway: 'If the picture doubles in every direction, its area quadruples.'
        },
        questions: [
          { id: 'q-geo-area-1', type: 'number', prompt: 'A similar figure is enlarged by a length scale factor of 3. What is the area scale factor?', answer: '9', hint: 'Area uses two dimensions. Square the length scale factor.', explanation: 'The area scale factor is 3² = 9.', difficulty: 2, objective: 'Similarity and area' },
          { id: 'q-geo-area-2', type: 'number', prompt: 'A triangle has base 10 and perpendicular height 6. What is its area?', answer: '30', hint: 'Use one half times base times perpendicular height.', explanation: 'Area = ½ × 10 × 6 = 30 square units.', difficulty: 1, objective: 'Triangle area' }
        ]
      },
      {
        id: 'geo-coordinate-distance', title: 'Coordinate geometry', summary: 'Translate a picture into differences in horizontal and vertical position.', difficulty: 2, minutes: 9,
        objectives: ['Find horizontal and vertical coordinate differences', 'Apply the Pythagorean theorem to distance', 'Recognize common right-triangle lengths'],
        body: {
          introduction: 'Coordinates turn geometry into arithmetic. The distance between two points is the hypotenuse of a right triangle whose legs are the horizontal and vertical changes.',
          explanation: ['Between (x₁, y₁) and (x₂, y₂), the horizontal change is x₂ − x₁ and the vertical change is y₂ − y₁.', 'By the Pythagorean theorem, distance² = (x₂ − x₁)² + (y₂ − y₁)².', 'A 3-4-5 triangle appears frequently: if the squared differences add to 25, the distance is 5.'],
          keyIdea: 'Square the horizontal and vertical changes, add, then take the square root.',
          example: { prompt: 'Find the distance between (1, 2) and (4, 6).', steps: ['The horizontal change is 4 − 1 = 3.', 'The vertical change is 6 − 2 = 4.', 'Distance = √(3² + 4²) = √25.'], answer: 'The distance is 5.' },
          explorer: { kind: 'area', title: 'Coordinate distance', prompt: 'Change the horizontal and vertical legs to see how the hypotenuse responds.', defaults: { number: 3, divisor: 4 } },
          takeaway: 'Distance on a grid is a Pythagorean theorem in disguise.'
        },
        questions: [
          { id: 'q-geo-coord-1', type: 'number', prompt: 'What is the distance between the points (1, 2) and (4, 6)?', answer: '5', hint: 'The horizontal and vertical changes are 3 and 4. Use the Pythagorean theorem.', explanation: 'Distance = √((4−1)² + (6−2)²) = √(9 + 16) = 5.', difficulty: 2, objective: 'Distance formula' },
          { id: 'q-geo-coord-2', type: 'number', prompt: 'A right triangle has legs of lengths 5 and 12. What is the hypotenuse?', answer: '13', hint: 'Square both legs, add, then take the square root.', explanation: 'The hypotenuse is √(5² + 12²) = √169 = 13.', difficulty: 2, objective: 'Pythagorean theorem' }
        ]
      }
    ]
  },
  {
    id: 'combinatorics', title: 'Combinatorics', shortTitle: 'Combinatorics', description: 'Count outcomes carefully, without missing or repeating any.', color: '#b47b8b', icon: 'grid', minutes: 32,
    lessons: [
      {
        id: 'comb-counting-principles', title: 'Counting by stages', summary: 'Use the multiplication principle to count choices made in sequence.', difficulty: 1, minutes: 8,
        objectives: ['Separate a process into stages', 'Multiply independent choice counts', 'Avoid double counting by using a consistent order'],
        body: {
          introduction: 'When a task happens in stages, count the options at each stage. Multiplying those counts gives the number of complete outcomes.',
          explanation: ['If one choice has a options and an independent next choice has b options, there are a × b ordered pairs.', 'The multiplication principle applies even when the available choices at a later step depend on an earlier choice, as long as you count the branches carefully.', 'A quick tree diagram can help organize small problems; a product is the efficient version of that tree.'],
          keyIdea: 'One choice from each stage: multiply the number of options.',
          example: { prompt: 'You have 3 shirts and 4 pairs of pants. How many different outfits can you make?', steps: ['Choose one of 3 shirts.', 'For each shirt, choose one of 4 pairs of pants.', 'Multiply the independent choices: 3 × 4.'], answer: 'There are 12 outfits.' },
          explorer: { kind: 'counting', title: 'Choice counter', prompt: 'Adjust the number of options at each stage to count complete outcomes.', defaults: { choices: 3, options: 4 } },
          takeaway: 'Make the stages explicit, then multiply.'
        },
        questions: [
          { id: 'q-comb-count-1', type: 'number', prompt: 'There are 3 shirts and 4 pairs of pants. How many different outfits use one of each?', answer: '12', hint: 'Choose a shirt, then choose pants. Each shirt can pair with every option of pants.', explanation: 'There are 3 × 4 = 12 outfit combinations.', difficulty: 1, objective: 'Multiplication principle' },
          { id: 'q-comb-count-2', type: 'number', prompt: 'How many different arrangements can be made using all three distinct letters C, A, and T?', answer: '6', hint: 'There are 3 choices for the first place, then 2, then 1.', explanation: 'The letters can be arranged in 3 × 2 × 1 = 6 ways.', difficulty: 2, objective: 'Permutations' }
        ]
      },
      {
        id: 'comb-combinations', title: 'Choosing groups', summary: 'Count selections when the order of chosen objects does not matter.', difficulty: 2, minutes: 9,
        objectives: ['Distinguish selections from arrangements', 'Compute small binomial coefficients', 'Avoid counting the same group in multiple orders'],
        body: {
          introduction: 'Choosing a group is different from arranging a line. If order does not matter, count each group once — not once for every possible order.',
          explanation: ['The number of ways to choose r objects from n distinct objects is “n choose r,” written C(n, r).', 'C(n, r) = n! / (r!(n − r)!). The denominator removes the reorderings of the chosen and unchosen objects.', 'For a small group, listing pairs or using symmetry can be faster than calculating factorials.'],
          keyIdea: 'If order does not matter, divide out the repeated orderings.',
          example: { prompt: 'How many two-person committees can be chosen from five people?', steps: ['Choose the first member in 5 ways and the second in 4 ways.', 'That counts each pair twice: once in each order.', 'Divide 5 × 4 by 2.'], answer: 'There are 10 committees.' },
          explorer: { kind: 'counting', title: 'Group selector', prompt: 'Explore how the number of pairs changes as the group size changes.', defaults: { choices: 5, options: 2 } },
          takeaway: 'A committee has no first or second member — order is not part of the outcome.'
        },
        questions: [
          { id: 'q-comb-choose-1', type: 'number', prompt: 'How many ways can you choose 2 objects from 5 distinct objects?', answer: '10', hint: 'There are 5 × 4 ordered pairs. How many times is each pair counted?', explanation: 'Each unordered pair is counted twice, so (5 × 4) ÷ 2 = 10.', difficulty: 2, objective: 'Combinations' },
          { id: 'q-comb-choose-2', type: 'number', prompt: 'How many two-person committees can be chosen from 6 people?', answer: '15', hint: 'Use C(6, 2) = 6 × 5 ÷ 2.', explanation: 'C(6, 2) = (6 × 5) ÷ 2 = 15 committees.', difficulty: 2, objective: 'Combinations and symmetry' }
        ]
      },
      {
        id: 'comb-probability', title: 'Probability & pigeonhole', summary: 'Compare favorable outcomes with all outcomes, and reason about guarantees.', difficulty: 3, minutes: 9,
        objectives: ['Calculate a probability from equally likely outcomes', 'Use a complement when convenient', 'Apply the pigeonhole principle to a guarantee'],
        body: {
          introduction: 'Probability is a ratio of favorable outcomes to possible outcomes when those outcomes are equally likely. Pigeonhole arguments answer a different question: what must happen, no matter what?',
          explanation: ['For equally likely outcomes, P(event) = favorable outcomes ÷ total outcomes.', 'Independent events multiply. For example, three fair coin flips have 2³ = 8 equally likely sequences.', 'The pigeonhole principle says that placing more objects than containers forces at least one container to hold multiple objects.'],
          keyIdea: 'For probabilities, count; for guarantees, ask how many containers are available.',
          example: { prompt: 'What is the probability of exactly one head in three fair coin flips?', steps: ['There are 2³ = 8 equally likely sequences.', 'Exactly one head can occur in HHH? No — list the choices: HTT, THT, TTH.', 'There are 3 favorable outcomes out of 8.'], answer: 'The probability is 3/8.' },
          explorer: { kind: 'counting', title: 'Pigeonhole explorer', prompt: 'How many picks guarantee that two objects share a category?', defaults: { choices: 2, options: 2 } },
          takeaway: 'A guarantee is about the worst case, not the most likely case.'
        },
        questions: [
          { id: 'q-comb-prob-1', type: 'number', prompt: 'What is the probability of exactly one head in three fair coin flips? Enter a decimal or fraction.', answer: '3/8', hint: 'There are 8 equally likely sequences. Exactly one head can appear in three positions.', explanation: 'The favorable sequences are HTT, THT, and TTH: 3 out of 8, so the probability is 3/8.', difficulty: 2, objective: 'Counting probability' },
          { id: 'q-comb-prob-2', type: 'number', prompt: 'A box contains red and blue balls. What is the minimum number of balls you must draw to guarantee that two drawn balls have the same color?', answer: '3', hint: 'Think about the worst case: how many can you draw while keeping all colors different?', explanation: 'There are 2 colors. In the worst case, the first two draws have different colors; the third must match one of them.', difficulty: 2, objective: 'Pigeonhole principle' }
        ]
      }
    ]
  }
];

export const achievements = [
  { slug: 'first-step', title: 'First step', description: 'Finish your first lesson.', category: 'Consistency', icon: 'footprints', xp: 20 },
  { slug: 'perfect-practice', title: 'Sharp thinking', description: 'Reach full mastery in a lesson.', category: 'Mastery', icon: 'target', xp: 25 },
  { slug: 'topic-explorer', title: 'Topic explorer', description: 'Complete a full three-lesson unit.', category: 'Milestones', icon: 'map', xp: 40 },
  { slug: 'ten-solves', title: 'Ten thoughtful solves', description: 'Answer ten practice questions.', category: 'Problem solving', icon: 'puzzle', xp: 25 },
  { slug: 'three-day-streak', title: 'A good rhythm', description: 'Keep a three-day learning streak.', category: 'Consistency', icon: 'flame', xp: 30 },
  { slug: 'first-assessment', title: 'On the clock', description: 'Complete your first timed challenge.', category: 'Competition prep', icon: 'timer', xp: 30 },
  { slug: 'better-than-before', title: 'A little better', description: 'Improve on an earlier assessment score.', category: 'Personal best', icon: 'trending-up', xp: 35 },
];
