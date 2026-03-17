hiii


Here is your comprehensive, verbose guide to mastering **Module 4 (Probability Distributions)**. 

Since you are short on time and this is an open-book exam, this guide is designed to teach you **how to recognize the problem type** and **which formula/steps to apply immediately**. 

I have ranked the topics from **Tier 1 (Guaranteed to appear)** to **Tier 3 (Rare curveballs)**. At the end, I have also included a highly valuable **Scientific Calculator Tricks** section to save you time.

---

# 🏆 TIER 1: The "Always Appears" Heavyweights
*If you only study one thing, study this. These topics appear in 100% of the previous year's papers.*

## 1. Normal (Gaussian) Distribution
**How to recognize it:** The question explicitly says "normally distributed" or gives a "mean and standard deviation" for continuous data (like marks, heights, life of bulbs).
**The Core Formula:** 
$$Z = \frac{X - \mu}{\sigma}$$
*(Where $X$ is the given value, $\mu$ is the mean, and $\sigma$ is the standard deviation).*

### Type A: Reverse Engineering Mean ($\mu$) and SD ($\sigma$)
* **Frequency:** Extremely High.
* **The Problem:** "10% of items are under 35 and 5% are above 90. Find the mean and standard deviation."
* **How to Solve:**
  1. **Convert to Probabilities:** 
     * "10% under 35" $\rightarrow P(X < 35) = 0.10$
     * "5% above 90" $\rightarrow P(X > 90) = 0.05 \implies P(X < 90) = 0.95$ *(Always work with "less than" area for standard Z-tables).*
  2. **Find Z-scores from the Table:** Open your textbook's Z-table. Look for the area inside the table closest to $0.10$ and $0.95$ to find the corresponding Z-values on the edges.
     * Area $0.10 \rightarrow Z_1 \approx -1.28$
     * Area $0.95 \rightarrow Z_2 \approx 1.64$ (or $1.645$)
  3. **Set up two equations:** Using $X = \mu + Z\sigma$:
     * Equation 1: $35 = \mu - 1.28\sigma$
     * Equation 2: $90 = \mu + 1.645\sigma$
  4. **Solve simultaneously** using your calculator to get $\mu$ and $\sigma$.

### Type B: Conditional Normal Probability
* **Frequency:** High.
* **The Problem:** "Find $P(X < 5 \mid X > 2)$"
* **How to Solve:**
  1. Use the conditional probability formula: $P(A \mid B) = \frac{P(A \cap B)}{P(B)}$
  2. Apply it to the bounds: $P(X < 5 \mid X > 2) = \frac{P(2 < X < 5)}{P(X > 2)}$
  3. Convert $X=2$ and $X=5$ to their respective Z-scores using $Z = \frac{X-\mu}{\sigma}$.
  4. Find the areas from the Z-table:
     * Numerator: Area between $Z_2$ and $Z_5$.
     * Denominator: $1 - \text{Area below } Z_2$.
  5. Divide the two areas.

---

# 🥇 TIER 2: The Discrete Giants
*Expect 1-2 full questions from these two distributions. They deal with counting exact numbers of successes (e.g., defective items, goals, patients).*

## 2. Binomial Distribution
**How to recognize it:** You are given a specific number of trials ($n$), a probability of success ($p$), and asked for the probability of exactly/at least $x$ successes.
**The Core Formulas:**
* **Probability Mass Function (PMF):** $P(X = x) = ^nC_x \cdot p^x \cdot q^{n-x}$ *(where $q = 1-p$)*
* **Mean:** $\mu = np$
* **Variance:** $\sigma^2 = npq$

### Type A: The "Fallacy" Question
* **Frequency:** Medium-High.
* **The Problem:** "Bring out the fallacy if any: The mean of a binomial distribution is 28 and standard deviation is 6."
* **How to Solve:**
  1. Mean $= np = 28$.
  2. Variance $= \sigma^2 = 6^2 = 36$.
  3. Notice that Variance is $npq$. So, $npq = 36$.
  4. Substitute $np$: $28 \cdot q = 36 \implies q = \frac{36}{28} = 1.28$.
  5. **The Fallacy:** Probability ($q$) can NEVER be greater than 1. Also, in a Binomial Distribution, **Variance must ALWAYS be less than the Mean**. Since $36 > 28$, the statement is inherently false.

### Type B: Binomial as a Secondary Step (Combined Distributions)
* **Frequency:** Medium.
* **The Problem:** "A tower's life is exponentially distributed... If 3 towers are erected, what is the probability that at least 2 stand after 35 years?"
* **How to Solve:** This is a two-step problem.
  1. **Step 1 (Find $p$ using Exponential):** First, find the probability of a *single* tower surviving. $p = P(X > 35) = e^{-\lambda \cdot 35}$. (Calculate this decimal).
  2. **Step 2 (Apply Binomial):** Now you have $n=3$ towers, and your success probability is $p$. Find $P(X \ge 2) = P(X=2) + P(X=3)$ using the Binomial PMF formula.

## 3. Poisson Distribution
**How to recognize it:** You are given an *average rate* ($\lambda$ or $\mu$) over time/space, OR you have a very large $n$ (e.g., 2000) and a very small $p$ (e.g., 0.001).
**The Core Formula:**
$$P(X = x) = \frac{e^{-\lambda} \cdot \lambda^x}{x!}$$
*(Note: For Poisson, Mean = Variance = $\lambda$)*

### Type A: Solving Algebraic Poisson Equations
* **Frequency:** High.
* **The Problem:** "If X is a Poisson variate satisfying $P(X = 2) = 9 P(X = 4) + 90 P(X = 6)$, find the mean and $P(X < 3)$."
* **How to Solve:**
  1. Expand using the formula:
     $$\frac{e^{-\lambda} \lambda^2}{2!} = 9 \left( \frac{e^{-\lambda} \lambda^4}{4!} \right) + 90 \left( \frac{e^{-\lambda} \lambda^6}{6!} \right)$$
  2. **Cancel out the common terms:** Cancel $e^{-\lambda}$ from all sides. Divide all terms by $\lambda^2$.
  3. You are left with a polynomial equation in terms of $\lambda$.
     $$\frac{1}{2} = \frac{9\lambda^2}{24} + \frac{90\lambda^4}{720}$$
  4. Simplify and solve for $\lambda$ (which is your mean). Let $\lambda^2 = t$ to make it a quadratic equation, solve for $t$, then square root it.
  5. Once you have $\lambda$, plug it back into the formula to find $P(X < 3) = P(0) + P(1) + P(2)$.

### Type B: Poisson Approximation to Binomial
* **Frequency:** Medium.
* **The Problem:** "Probability of bad reaction is 0.001. Out of 2000 individuals, find probability that at most 2 suffer."
* **How to Solve:** Do NOT use Binomial here, the numbers are too big.
  1. Calculate Mean $\lambda = n \times p = 2000 \times 0.001 = 2$.
  2. Apply Poisson formula with $\lambda = 2$. "At most 2" means $P(X=0) + P(X=1) + P(X=2)$.

---

# 🥉 TIER 3: Niche but Easy Curveballs
*These appear less often but require specific knowledge.*

## 4. Hypergeometric Distribution (Sampling WITHOUT Replacement)
**How to recognize it:** You are picking a small sample from a finite population where you know the exact counts. (e.g., "10 boxes, 2 are contaminated. You select 4 boxes. Probability that at least 1 is contaminated?")
**How to Solve:**
Do not use complicated formulas. Just use simple combinations (`nCr`).
* Probability = $\frac{\text{Ways to choose what you want}}{\text{Total possible ways to choose}}$
* Example for EXACTLY 1 contaminated: 
  * Ways to choose 1 contaminated (out of 2): $^2C_1$
  * Ways to choose 3 safe (out of 8 safe): $^8C_3$
  * Total ways to choose 4 boxes (out of 10): $^{10}C_4$
  * $P(X=1) = \frac{^2C_1 \times ^8C_3}{^{10}C_4}$

## 5. Exponential Distribution
**How to recognize it:** Deals with "lifetime", "time between breakdowns", or "waiting time".
**The Core Formulas:**
* Density function: $f(x) = \lambda e^{-\lambda x}$
* **Cumulative Probability (Learn this, it skips integration):**
  * $P(X \le x) = 1 - e^{-\lambda x}$
  * $P(X > x) = e^{-\lambda x}$
* Mean = $\frac{1}{\lambda}$, Variance = $\frac{1}{\lambda^2}$

## 6. The "Rare" Distributions (Weibull, Erlang, Gamma)
* **Frequency in PYQs:** 0%. (They exist in the textbook, but rarely show up in CAT-II).
* **Open Book Strategy:** Do not memorize these. If a question explicitly says "Weibull distribution", simply open your textbook to the Weibull section, copy the $f(x)$ formula, and plug the given parameters ($\alpha, \beta$) directly into it. 

---

# 🖩 BONUS: Scientific Calculator Tricks (Casio fx-991EX / ES Plus)
*Your non-programmable calculator is a legal cheat code. Here is how to use it to save 10+ minutes.*

### Trick 1: Solving Annoying Equations Instantly (The `SOLVE` function)
When you get an equation like $35 = \mu - 1.28\sigma$ and $90 = \mu + 1.645\sigma$, use the simultaneous equation solver.
* **fx-991EX (ClassWiz):** Press `MENU` $\rightarrow$ `Equation/Func` (Option A) $\rightarrow$ `1: Simul Equation` $\rightarrow$ `2 Unknowns`. Enter the coefficients.
* **fx-991ES Plus:** Press `MODE` $\rightarrow$ `5: EQN` $\rightarrow$ `1` (for $aX + bY = c$).

### Trick 2: Calculating Distributions WITHOUT the Formula
Did you know your calculator has Binomial, Poisson, and Normal functions built-in? You can use this to verify your manual answers!
* **fx-991EX (ClassWiz):** Press `MENU` $\rightarrow$ `7: Distribution`.
  * **Binomial PD:** Gives you exact probability $P(X = x)$. Enter $x$, $n$, and $p$.
  * **Binomial CD:** Gives you cumulative $P(X \le x)$. Great for "at most" questions.
  * **Poisson PD/CD:** Enter $x$ and $\lambda$.
  * **Normal CD:** Enter Lower bound, Upper bound, $\sigma$, and $\mu$. (E.g., for $P(X > 75)$, Lower = 75, Upper = 9999999, enter your $\sigma$ and $\mu$). *You don't even need the Z-table for this!*

### Trick 3: The `TABLE` Hack for "Find Minimum n" Questions
Sometimes a question asks: "How many boxes must be selected so the probability is > 0.75?"
Instead of guessing and checking manually:
1. Press `MENU` $\rightarrow$ `Table` (Option 8 or 9 depending on model).
2. Enter the formula as a function of $X$ (where $X$ is $n$). For example, $f(x) = 1 - 0.8^x$.
3. Set Start = 1, End = 10, Step = 1.
4. The calculator will generate a table. Scroll down until the $f(x)$ value crosses $0.75$. The corresponding $x$ value is your minimum $n$!

### Trick 4: Fast Combinations
Never calculate factorials manually.
For $^{10}C_4$:
Type `10` $\rightarrow$ Press `SHIFT` $\rightarrow$ Press `÷` (which is `nCr`) $\rightarrow$ Type `4` $\rightarrow$ Press `=`. Output is 210.
