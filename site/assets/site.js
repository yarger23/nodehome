(() => {
  "use strict";

  const numberFormat = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2
  });

  const menuDisclosures = Array.from(document.querySelectorAll(".menu-disclosure"));
  menuDisclosures.forEach((menu) => {
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    });
    menu.addEventListener("focusout", (event) => {
      if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
    });
  });
  document.addEventListener("pointerdown", (event) => {
    menuDisclosures.forEach((menu) => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  });

  const getNumber = (form, name) => {
    const field = form.elements.namedItem(name);
    return field ? Number(field.value) : 0;
  };

  const showResult = (form, title, lines) => {
    const box = form.querySelector(".calc-result");
    if (!box) return;
    box.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = title;
    box.append(heading);
    lines.forEach((line, index) => {
      const paragraph = document.createElement("p");
      if (index === 0) paragraph.className = "result-value";
      paragraph.textContent = line;
      box.append(paragraph);
    });
    box.hidden = false;
  };

  document.querySelectorAll("[data-material-calculator]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const type = form.dataset.materialCalculator;
      const area = getNumber(form, "area");
      const thickness = getNumber(form, "thickness");
      const reserve = getNumber(form, "reserve");
      const multiplier = 1 + reserve / 100;

      if (type === "plaster") {
        const rate = getNumber(form, "rate");
        const bag = getNumber(form, "bag");
        const kilograms = area * thickness * rate * multiplier;
        const bags = Math.ceil(kilograms / bag);
        showResult(form, "Предварительная оценка", [
          numberFormat.format(kilograms) + " кг сухой смеси",
          "Около " + bags + " мешков по " + numberFormat.format(bag) + " кг"
        ]);
        return;
      }

      if (type === "screed") {
        const liters = area * thickness * multiplier;
        const cubicMeters = liters / 1000;
        showResult(form, "Геометрический объём", [
          numberFormat.format(cubicMeters) + " м³",
          numberFormat.format(liters) + " л с учётом выбранного запаса"
        ]);
        return;
      }

      if (type === "paint") {
        const coats = getNumber(form, "coats");
        const coverage = getNumber(form, "coverage");
        const liters = area * coats / coverage * multiplier;
        showResult(form, "Предварительная оценка", [
          numberFormat.format(liters) + " л краски",
          "Расчёт для " + coats + " слоёв"
        ]);
      }
    });
  });

  const searchPage = document.querySelector("[data-search-page]");
  if (searchPage) {
    const input = searchPage.querySelector('input[name="q"]');
    const status = searchPage.querySelector(".search-status");
    const items = Array.from(searchPage.querySelectorAll("[data-search-item]"));
    const query = new URLSearchParams(window.location.search).get("q") || "";
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    if (input) input.value = query;

    let visibleCount = 0;
    items.forEach((item) => {
      const matches = !normalizedQuery ||
        (item.dataset.searchText || "").includes(normalizedQuery);
      item.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    if (status) {
      status.textContent = normalizedQuery
        ? (visibleCount
          ? "Найдено материалов: " + visibleCount
          : "По этому запросу ничего не найдено. Попробуйте другое слово.")
        : "Все разделы и опубликованные материалы.";
    }
  }
})();
