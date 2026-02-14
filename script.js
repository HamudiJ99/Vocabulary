// App-Logik für Arabisch Vokabeltrainer
// (Vokabeldaten werden aus vocabulary.js geladen)

// State
let learnedWords = JSON.parse(localStorage.getItem("learnedWords") || "[]");
let wordStars = JSON.parse(localStorage.getItem("wordStars") || "{}");
let currentView = "mindmap";
let quizState = { current: 0, score: 0, questions: [] };
let flashcardState = {
  current: 0,
  cards: [],
  selectedCategory: "all",
  starFilter: "all",
  hideKnown: false,
  showOverview: false,
  reverseMode: false,
};
let currentWord = null;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  renderCategories();
  updateStats();
  setupSearch();
  populateCategorySelector();
});

// Render categories
function renderCategories(filteredVocab = null) {
  const grid = document.getElementById("categoriesGrid");
  grid.innerHTML = "";

  const vocabToRender = filteredVocab || vocabulary;
  let catIndex = 1;

  for (const [category, data] of Object.entries(vocabToRender)) {
    if (data.words && data.words.length > 0) {
      const card = document.createElement("div");
      card.className = `category-card cat-${catIndex % 20 || 20}`;
      card.innerHTML = `
                <div class="category-header">
                    <h3 onclick="toggleCategory(this.closest('.category-card'))">
                        <span class="category-icon">${
                          data.icon
                        }</span> ${category}
                    </h3>
                    <div style="display: flex; align-items: center;">
                        <span class="count">${data.words.length}</span>
                        <button class="flashcard-btn-small" onclick="startCategoryFlashcards('${escapeHtml(
                          category,
                        )}'); event.stopPropagation();" title="Flashcards für diese Kategorie">🃏</button>
                    </div>
                </div>
                <div class="category-words">
                    ${data.words
                      .map(
                        (word) => `
                        <div class="word-item ${
                          isLearned(word.ar) ? "learned" : ""
                        }" 
                             onclick="showWordDetail('${escapeHtml(
                               word.ar,
                             )}', '${escapeHtml(word.en)}')">
                            <span class="word-english">${word.en}</span>
                            <span class="word-arabic">${word.ar}</span>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            `;
      grid.appendChild(card);
      catIndex++;
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/'/g, "\\'");
}

function toggleCategory(card) {
  card.classList.toggle("expanded");
}

function expandAll() {
  document.querySelectorAll(".category-card").forEach((card) => {
    card.classList.add("expanded");
  });
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      renderCategories();
      return;
    }

    const filtered = {};
    for (const [category, data] of Object.entries(vocabulary)) {
      const matchingWords = data.words.filter(
        (word) =>
          word.ar.includes(query) || word.en.toLowerCase().includes(query),
      );
      if (matchingWords.length > 0) {
        filtered[category] = { ...data, words: matchingWords };
      }
    }
    renderCategories(filtered);
  });
}

// Populate category selector for flashcards
function populateCategorySelector() {
  const selector = document.getElementById("categorySelector");
  if (!selector) return;

  selector.innerHTML = '<option value="all">📚 Alle Kategorien</option>';

  for (const [category, data] of Object.entries(vocabulary)) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = `${data.icon} ${category} (${data.words.length})`;
    selector.appendChild(option);
  }
}

// Star system functions
function getWordStars(arabic) {
  return wordStars[arabic] || 0;
}

function setWordStars(arabic, stars) {
  stars = Math.min(3, Math.max(0, stars));
  wordStars[arabic] = stars;
  localStorage.setItem("wordStars", JSON.stringify(wordStars));
}

function incrementWordStars(arabic) {
  const current = getWordStars(arabic);
  if (current < 3) {
    setWordStars(arabic, current + 1);
  }
  return getWordStars(arabic);
}

function renderStars(count) {
  let stars = "";
  for (let i = 0; i < 3; i++) {
    if (i < count) {
      stars += "⭐";
    } else {
      stars += "☆";
    }
  }
  return stars;
}

function getFilteredWords(category) {
  let words = getWordsForCategory(category);

  // Apply star filter
  if (flashcardState.starFilter !== "all") {
    const targetStars = parseInt(flashcardState.starFilter);
    words = words.filter((w) => getWordStars(w.ar) === targetStars);
  }

  // Apply hide known filter (hide 3-star words)
  if (flashcardState.hideKnown) {
    words = words.filter((w) => getWordStars(w.ar) < 3);
  }

  return words;
}

function onStarFilterChange() {
  const filter = document.getElementById("starFilter");
  if (filter) {
    flashcardState.starFilter = filter.value;
  }
  startFlashcards(flashcardState.selectedCategory);
}

function onHideKnownChange() {
  const checkbox = document.getElementById("hideKnown");
  if (checkbox) {
    flashcardState.hideKnown = checkbox.checked;
  }
  startFlashcards(flashcardState.selectedCategory);
}

function toggleOverview() {
  flashcardState.showOverview = !flashcardState.showOverview;
  const overviewPanel = document.getElementById("flashcardOverview");
  const flashcardMain = document.getElementById("flashcardMain");
  const overviewBtn = document.getElementById("overviewBtn");

  if (flashcardState.showOverview) {
    overviewPanel.style.display = "block";
    flashcardMain.style.display = "none";
    overviewBtn.textContent = "📝 Karteikarten";
    renderOverview();
  } else {
    overviewPanel.style.display = "none";
    flashcardMain.style.display = "block";
    overviewBtn.textContent = "📋 Übersicht";
  }
}

function renderOverview() {
  const container = document.getElementById("overviewContent");
  if (!container) return;

  const words = getFilteredWords(flashcardState.selectedCategory);
  const searchInput = document.getElementById("overviewSearch");
  const searchQuery = searchInput ? searchInput.value.toLowerCase() : "";

  let filteredWords = words;
  if (searchQuery) {
    filteredWords = words.filter(
      (w) =>
        w.ar.includes(searchQuery) || w.en.toLowerCase().includes(searchQuery),
    );
  }

  // Sort by stars (descending)
  filteredWords.sort((a, b) => getWordStars(b.ar) - getWordStars(a.ar));

  container.innerHTML = filteredWords
    .map((word) => {
      const stars = getWordStars(word.ar);
      return `
      <div class="overview-item" onclick="showWordDetail('${escapeHtml(
        word.ar,
      )}', '${escapeHtml(word.en)}')">
        <span class="overview-stars">${renderStars(stars)}</span>
        <span class="overview-arabic">${word.ar}</span>
        <span class="overview-english">${word.en}</span>
      </div>
    `;
    })
    .join("");

  if (filteredWords.length === 0) {
    container.innerHTML =
      '<div class="overview-empty">Keine Wörter gefunden</div>';
  }

  // Update count
  const countEl = document.getElementById("overviewCount");
  if (countEl) {
    countEl.textContent = `${filteredWords.length} Wörter`;
  }
}

// View switching
function showView(view) {
  document
    .querySelectorAll(".view-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  document.getElementById("mindmapView").style.display =
    view === "mindmap" ? "flex" : "none";
  document
    .getElementById("quizView")
    .classList.toggle("active", view === "quiz");
  document
    .getElementById("flashcardView")
    .classList.toggle("active", view === "flashcard");

  if (view === "quiz") startQuiz();
  if (view === "flashcard") startFlashcards();
}

// Word detail modal
function showWordDetail(arabic, english) {
  currentWord = { ar: arabic, en: english };
  document.getElementById("modalArabic").textContent = arabic;
  document.getElementById("modalEnglish").textContent = english;

  const btn = document.getElementById("modalLearnBtn");
  if (isLearned(arabic)) {
    btn.textContent = "✓ Gelernt";
    btn.classList.add("learned");
  } else {
    btn.textContent = "Als gelernt markieren";
    btn.classList.remove("learned");
  }

  document.getElementById("wordModal").classList.add("active");
}

function closeModal() {
  document.getElementById("wordModal").classList.remove("active");
}

function toggleLearned() {
  if (!currentWord) return;

  const idx = learnedWords.indexOf(currentWord.ar);
  if (idx === -1) {
    learnedWords.push(currentWord.ar);
  } else {
    learnedWords.splice(idx, 1);
  }

  localStorage.setItem("learnedWords", JSON.stringify(learnedWords));
  updateStats();
  renderCategories();

  const btn = document.getElementById("modalLearnBtn");
  if (isLearned(currentWord.ar)) {
    btn.textContent = "✓ Gelernt";
    btn.classList.add("learned");
  } else {
    btn.textContent = "Als gelernt markieren";
    btn.classList.remove("learned");
  }
}

function isLearned(arabic) {
  return learnedWords.includes(arabic);
}

// Stats
function updateStats() {
  const total = getAllWords().length;
  const learned = learnedWords.length;
  const percent = Math.round((learned / total) * 100);

  document.getElementById("totalWords").textContent = total;
  document.getElementById("learnedWords").textContent = learned;
  document.getElementById("progress").textContent = percent + "%";
  document.getElementById("progressPercent").textContent = percent + "%";
  document.getElementById("progressBar").style.width = percent + "%";
}

function getAllWords() {
  const all = [];
  for (const data of Object.values(vocabulary)) {
    all.push(...data.words);
  }
  return all;
}

function getWordsForCategory(category) {
  if (category === "all") {
    return getAllWords();
  }
  return vocabulary[category]?.words || [];
}

// Quiz
function startQuiz() {
  const allWords = getAllWords();
  const shuffled = allWords.sort(() => Math.random() - 0.5).slice(0, 10);

  quizState = {
    current: 0,
    score: 0,
    questions: shuffled.map((word) => ({
      arabic: word.ar,
      correct: word.en,
      options: getRandomOptions(word.en, allWords),
    })),
  };

  document.getElementById("quizResult").style.display = "none";
  document.querySelector(".quiz-card").style.display = "block";
  showQuizQuestion();
}

function getRandomOptions(correct, allWords) {
  const options = [correct];
  const otherWords = allWords.filter((w) => w.en !== correct);

  while (options.length < 4) {
    const random = otherWords[Math.floor(Math.random() * otherWords.length)];
    if (!options.includes(random.en)) {
      options.push(random.en);
    }
  }

  return options.sort(() => Math.random() - 0.5);
}

function showQuizQuestion() {
  const q = quizState.questions[quizState.current];

  document.getElementById("quizCurrent").textContent = quizState.current + 1;
  document.getElementById("quizTotal").textContent = quizState.questions.length;
  document.getElementById("quizProgress").style.width =
    ((quizState.current + 1) / quizState.questions.length) * 100 + "%";
  document.getElementById("quizQuestion").textContent = q.arabic;

  const optionsDiv = document.getElementById("quizOptions");
  optionsDiv.innerHTML = q.options
    .map(
      (opt) => `
        <button class="quiz-option" onclick="checkAnswer('${escapeHtml(
          opt,
        )}', '${escapeHtml(q.correct)}')">${opt}</button>
    `,
    )
    .join("");
}

function checkAnswer(selected, correct) {
  const buttons = document.querySelectorAll(".quiz-option");
  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === correct) {
      btn.classList.add("correct");
    } else if (btn.textContent === selected && selected !== correct) {
      btn.classList.add("wrong");
    }
  });

  if (selected === correct) {
    quizState.score++;
  }

  setTimeout(() => {
    quizState.current++;
    if (quizState.current < quizState.questions.length) {
      showQuizQuestion();
    } else {
      showQuizResult();
    }
  }, 1500);
}

function showQuizResult() {
  document.querySelector(".quiz-card").style.display = "none";
  document.getElementById("quizResult").style.display = "block";
  document.getElementById(
    "quizScore",
  ).textContent = `${quizState.score}/${quizState.questions.length}`;
}

// Flashcards
function startFlashcards(category = null) {
  const selector = document.getElementById("categorySelector");
  const selectedCategory = category || (selector ? selector.value : "all");

  flashcardState.selectedCategory = selectedCategory;

  const words = getFilteredWords(selectedCategory);

  flashcardState.current = 0;
  flashcardState.cards = words.sort(() => Math.random() - 0.5);

  document.getElementById("flashcardTotal").textContent =
    flashcardState.cards.length;

  // Update category info
  const categoryName =
    selectedCategory === "all"
      ? "Alle Kategorien"
      : `${vocabulary[selectedCategory]?.icon || ""} ${selectedCategory}`;

  const infoElement = document.getElementById("flashcardCategoryInfo");
  if (infoElement) {
    infoElement.textContent = categoryName;
  }

  // Update selector if needed
  if (selector && selector.value !== selectedCategory) {
    selector.value = selectedCategory;
  }

  showFlashcard();
}

// Start flashcards for a specific category (called from category card)
function startCategoryFlashcards(category) {
  // Switch to flashcard view
  document
    .querySelectorAll(".view-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelector('.view-btn[onclick*="flashcard"]')
    .classList.add("active");

  document.getElementById("mindmapView").style.display = "none";
  document.getElementById("quizView").classList.remove("active");
  document.getElementById("flashcardView").classList.add("active");

  // Set the selector to this category
  const selector = document.getElementById("categorySelector");
  if (selector) {
    selector.value = category;
  }

  startFlashcards(category);
}

function onCategoryChange() {
  startFlashcards();
}

function showFlashcard() {
  if (flashcardState.cards.length === 0) {
    document.getElementById("flashcardFrontText").textContent = "Keine Wörter";
    document.getElementById("flashcardBackText").textContent =
      "No words available";
    const starsEl = document.getElementById("flashcardStars");
    if (starsEl) starsEl.textContent = "";
    return;
  }

  const card = flashcardState.cards[flashcardState.current];
  const stars = getWordStars(card.ar);

  document.getElementById("flashcardCurrent").textContent =
    flashcardState.current + 1;

  // Update card content based on reverse mode
  const frontText = document.getElementById("flashcardFrontText");
  const backText = document.getElementById("flashcardBackText");
  const frontLabel = document.getElementById("flashcardFrontLabel");
  const backLabel = document.getElementById("flashcardBackLabel");

  if (flashcardState.reverseMode) {
    frontText.textContent = card.en;
    frontText.className = "flashcard-text";
    backText.textContent = card.ar;
    backText.className = "flashcard-arabic";
    if (frontLabel) frontLabel.textContent = "Englisch";
    if (backLabel) backLabel.textContent = "Arabisch";
  } else {
    frontText.textContent = card.ar;
    frontText.className = "flashcard-arabic";
    backText.textContent = card.en;
    backText.className = "flashcard-text";
    if (frontLabel) frontLabel.textContent = "Arabisch";
    if (backLabel) backLabel.textContent = "Englisch";
  }

  document.getElementById("flashcard").classList.remove("flipped");

  // Update stars display
  const starsEl = document.getElementById("flashcardStars");
  if (starsEl) {
    starsEl.textContent = renderStars(stars);
  }
}

function toggleReverseMode() {
  flashcardState.reverseMode = !flashcardState.reverseMode;
  const btn = document.getElementById("reverseModeBtn");
  if (btn) {
    btn.textContent = flashcardState.reverseMode ? "🔄 AR → EN" : "🔄 EN → AR";
    btn.classList.toggle("active", flashcardState.reverseMode);
  }
  showFlashcard();
}

function flipCard() {
  document.getElementById("flashcard").classList.toggle("flipped");
}

function nextFlashcard(known) {
  if (flashcardState.cards.length === 0) return;

  const currentArabic = flashcardState.cards[flashcardState.current].ar;

  if (known) {
    // Increment stars (max 3)
    const newStars = incrementWordStars(currentArabic);

    // Also mark as learned for backwards compatibility
    if (!learnedWords.includes(currentArabic)) {
      learnedWords.push(currentArabic);
      localStorage.setItem("learnedWords", JSON.stringify(learnedWords));
      updateStats();
      renderCategories();
    }
  }

  flashcardState.current++;
  if (flashcardState.current < flashcardState.cards.length) {
    showFlashcard();
  } else {
    // Restart with same category
    startFlashcards(flashcardState.selectedCategory);
  }
}

// Close modal on outside click
document.getElementById("wordModal")?.addEventListener("click", (e) => {
  if (e.target.id === "wordModal") {
    closeModal();
  }
});

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
  // Flashcard keyboard shortcuts
  if (document.getElementById("flashcardView").classList.contains("active")) {
    if (e.key === " " || e.key === "Enter") {
      flipCard();
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "1") {
      nextFlashcard(true);
    } else if (e.key === "ArrowLeft" || e.key === "2") {
      nextFlashcard(false);
    }
  }
});
