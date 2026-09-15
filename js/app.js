// 이 프로젝트는 오프라인 캐시를 사용하지 않습니다.
if ("caches" in window) {
  caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
}

const $ = (id) => document.getElementById(id);

const form = $("residentForm");
const photoInput = $("photoInput");
const photoPreview = $("photoPreview");
const genreList = $("genreList");
const genreCount = $("genreCount");
const intro = $("intro");
const introCount = $("introCount");

const resultSection = $("resultSection");
const canvas = $("cardCanvas");
const ctx = canvas.getContext("2d");
const downloadBtn = $("downloadBtn");
const rerollStampBtn = $("rerollStampBtn");

const cropModal = $("cropModal");
const cropCanvas = $("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");
const cropZoom = $("cropZoom");
const cropApplyBtn = $("cropApplyBtn");
const cropCancelBtn = $("cropCancelBtn");
const cropCloseBtn = $("cropCloseBtn");

const stickerModal = $("stickerModal");
const stickerCanvas = $("stickerCanvas");
const stickerCtx = stickerCanvas.getContext("2d");
const stickerScaleInput = $("stickerScale");
const stickerRotationInput = $("stickerRotation");
const stickerApplyBtn = $("stickerApplyBtn");
const stickerCancelBtn = $("stickerCancelBtn");
const stickerCloseBtn = $("stickerCloseBtn");
const stickerEditingLabel = $("stickerEditingLabel");

const stampRandomModeBtn = $("stampRandomModeBtn");
const stampCustomModeBtn = $("stampCustomModeBtn");
const stampRandomPanel = $("stampRandomPanel");
const stampCustomPanel = $("stampCustomPanel");
const customStampText = $("customStampText");
const customStampCount = $("customStampCount");
const stampColorPresetList = $("stampColorPresetList");
const stampColorPicker = $("stampColorPicker");
const stampColorCode = $("stampColorCode");

const stickerSlots = [1, 2, 3].map((n, index) => ({
  index,
  input: $(`favoriteImageInput${n}`),
  preview: $(`favoriteImagePreview${n}`),
  editBtn: $(`editFavoriteImageBtn${n}`),
  removeBtn: $(`removeFavoriteImageBtn${n}`),
}));

const selectedGenres = new Set();

let profileImage = null;
let currentStamp = "";
let stampMode = "random";
let stampColor = "#171717";

let cropSourceImage = null;
let cropBaseScale = 1;
let cropScale = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDragging = false;
let cropPointerId = null;
let cropLastX = 0;
let cropLastY = 0;

let stickers = Array.from({ length: 3 }, () => ({ image: null, previewSrc: "", transform: null }));
let activeStickerIndex = null;
let stickerDraftImage = null;
let stickerDraftPreviewSrc = "";
let stickerDraftTransform = null;
let stickerDragging = false;
let stickerPointerId = null;
let stickerLastX = 0;
let stickerLastY = 0;

const STICKER_BASE_SIZE = 200;
const CARD_PADDING = 40;
const DEFAULT_STAMP_COLOR = "#171717";

const stamps = [
  "정상 주민",
  "신입 주민",
  "고인물 주의",
  "최애 과몰입",
  "굿즈 소비 위험군",
  "새벽 정주행 주민",
  "픽업 폭사 주의",
  "취향 전파 가능",
];

genreList.addEventListener("click", (event) => {
  const button = event.target.closest(".chip");
  if (!button) return;

  const value = button.dataset.value;
  if (selectedGenres.has(value)) {
    selectedGenres.delete(value);
    button.classList.remove("is-selected");
  } else {
    if (selectedGenres.size >= 5) {
      alert("주력 장르는 최대 5개까지 선택할 수 있어요.");
      return;
    }
    selectedGenres.add(value);
    button.classList.add("is-selected");
  }
  genreCount.textContent = selectedGenres.size;
});

intro.addEventListener("input", () => {
  introCount.textContent = intro.value.length;
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  try {
    ensureImageFile(file);
    const dataUrl = await fileToDataURL(file);
    cropSourceImage = await loadImage(dataUrl);
    openCropper(cropSourceImage);
  } catch (error) {
    handleImageLoadError(error, photoInput);
  }
});

stickerSlots.forEach((slot) => {
  slot.input.addEventListener("change", async () => {
    const file = slot.input.files?.[0];
    if (!file) return;
    try {
      ensureImageFile(file);
      const dataUrl = await fileToDataURL(file);
      const image = await loadImage(dataUrl);
      activeStickerIndex = slot.index;
      stickerDraftImage = image;
      stickerDraftPreviewSrc = dataUrl;
      stickerDraftTransform = createDefaultStickerTransform(slot.index);
      openStickerEditor(slot.index);
    } catch (error) {
      handleImageLoadError(error, slot.input);
    }
  });

  slot.editBtn.addEventListener("click", () => {
    const sticker = stickers[slot.index];
    if (!sticker.image || !sticker.transform) return;
    activeStickerIndex = slot.index;
    stickerDraftImage = sticker.image;
    stickerDraftPreviewSrc = sticker.previewSrc;
    stickerDraftTransform = { ...sticker.transform };
    openStickerEditor(slot.index);
  });

  slot.removeBtn.addEventListener("click", () => {
    stickers[slot.index] = { image: null, previewSrc: "", transform: null };
    slot.input.value = "";
    refreshStickerSlotUI(slot.index);
    if (!resultSection.hidden) drawCard();
  });
});

stampRandomModeBtn.addEventListener("click", () => {
  setStampMode("random");
});

stampCustomModeBtn.addEventListener("click", () => {
  setStampMode("custom");
  customStampText.focus();
});

customStampText.addEventListener("input", () => {
  const value = [...customStampText.value].slice(0, 8).join("");
  if (customStampText.value !== value) customStampText.value = value;
  customStampCount.textContent = [...customStampText.value].length;
  if (!resultSection.hidden && stampMode === "custom") {
    currentStamp = customStampText.value.trim() || currentStamp;
    drawCard();
  }
});

stampColorPresetList.addEventListener("click", (event) => {
  const button = event.target.closest(".stamp-color-btn");
  if (!button) return;
  setStampColor(button.dataset.color || DEFAULT_STAMP_COLOR, true);
});

stampColorPicker.addEventListener("input", () => {
  setStampColor(stampColorPicker.value, false);
});

stampColorCode.addEventListener("input", () => {
  const value = stampColorCode.value.trim();
  if (value.length === 7 && isValidHexColor(value)) {
    setStampColor(value, false);
  }
});

stampColorCode.addEventListener("blur", () => {
  const value = normalizeHexColor(stampColorCode.value) || stampColor;
  setStampColor(value, false);
});

cropZoom.addEventListener("input", () => {
  if (!cropSourceImage) return;
  const oldScale = cropScale;
  cropScale = cropBaseScale * Number(cropZoom.value);
  const cx = cropCanvas.width / 2;
  const cy = cropCanvas.height / 2;
  const ratio = cropScale / oldScale;
  cropOffsetX = cx - (cx - cropOffsetX) * ratio;
  cropOffsetY = cy - (cy - cropOffsetY) * ratio;
  clampCropOffset();
  renderCropper();
});

cropCanvas.addEventListener("pointerdown", (event) => {
  if (!cropSourceImage) return;
  cropDragging = true;
  cropPointerId = event.pointerId;
  cropLastX = event.clientX;
  cropLastY = event.clientY;
  cropCanvas.classList.add("is-dragging");
  cropCanvas.setPointerCapture(event.pointerId);
});

cropCanvas.addEventListener("pointermove", (event) => {
  if (!cropDragging || event.pointerId !== cropPointerId) return;
  const rect = cropCanvas.getBoundingClientRect();
  const scaleX = cropCanvas.width / rect.width;
  const scaleY = cropCanvas.height / rect.height;
  cropOffsetX += (event.clientX - cropLastX) * scaleX;
  cropOffsetY += (event.clientY - cropLastY) * scaleY;
  cropLastX = event.clientX;
  cropLastY = event.clientY;
  clampCropOffset();
  renderCropper();
});

cropCanvas.addEventListener("pointerup", stopCropDrag);
cropCanvas.addEventListener("pointercancel", stopCropDrag);

cropApplyBtn.addEventListener("click", async () => {
  if (!cropSourceImage) return;
  const output = document.createElement("canvas");
  output.width = 600;
  output.height = 800;
  const outputCtx = output.getContext("2d");
  outputCtx.fillStyle = "#e6e0d5";
  outputCtx.fillRect(0, 0, output.width, output.height);
  drawCropImage(outputCtx);
  const croppedDataUrl = output.toDataURL("image/jpeg", 0.92);
  profileImage = await loadImage(croppedDataUrl);
  photoPreview.innerHTML = "";
  const img = document.createElement("img");
  img.src = croppedDataUrl;
  img.alt = "자른 프로필 사진";
  photoPreview.appendChild(img);
  photoPreview.classList.add("has-image");
  closeCropper();
  if (!resultSection.hidden) drawCard();
});

cropCancelBtn.addEventListener("click", closeCropper);
cropCloseBtn.addEventListener("click", closeCropper);
cropModal.addEventListener("click", (event) => {
  if (event.target === cropModal) closeCropper();
});

stickerScaleInput.addEventListener("input", () => {
  if (!stickerDraftTransform || activeStickerIndex === null || !stickerDraftImage) return;
  stickerDraftTransform.scale = Number(stickerScaleInput.value);
  clampStickerTransform(stickerDraftTransform, stickerDraftImage);
  renderStickerEditor();
});

stickerRotationInput.addEventListener("input", () => {
  if (!stickerDraftTransform || activeStickerIndex === null || !stickerDraftImage) return;
  stickerDraftTransform.rotation = Number(stickerRotationInput.value);
  clampStickerTransform(stickerDraftTransform, stickerDraftImage);
  renderStickerEditor();
});

stickerCanvas.addEventListener("pointerdown", (event) => {
  if (!stickerDraftImage || !stickerDraftTransform) return;
  const point = getCanvasPoint(stickerCanvas, event);
  if (!pointInsideSticker(point.x, point.y, stickerDraftImage, stickerDraftTransform)) return;
  stickerDragging = true;
  stickerPointerId = event.pointerId;
  stickerLastX = point.x;
  stickerLastY = point.y;
  stickerCanvas.classList.add("is-dragging");
  stickerCanvas.setPointerCapture(event.pointerId);
});

stickerCanvas.addEventListener("pointermove", (event) => {
  if (!stickerDragging || event.pointerId !== stickerPointerId || !stickerDraftTransform || !stickerDraftImage) return;
  const point = getCanvasPoint(stickerCanvas, event);
  const dx = point.x - stickerLastX;
  const dy = point.y - stickerLastY;
  stickerDraftTransform.x += dx;
  stickerDraftTransform.y += dy;
  stickerLastX = point.x;
  stickerLastY = point.y;
  clampStickerTransform(stickerDraftTransform, stickerDraftImage);
  renderStickerEditor();
});

stickerCanvas.addEventListener("pointerup", stopStickerDrag);
stickerCanvas.addEventListener("pointercancel", stopStickerDrag);

stickerApplyBtn.addEventListener("click", () => {
  if (activeStickerIndex === null || !stickerDraftImage || !stickerDraftTransform) return;
  stickers[activeStickerIndex] = {
    image: stickerDraftImage,
    previewSrc: stickerDraftPreviewSrc,
    transform: { ...stickerDraftTransform },
  };
  refreshStickerSlotUI(activeStickerIndex);
  closeStickerEditor();
  if (!resultSection.hidden) drawCard();
});

stickerCancelBtn.addEventListener("click", closeStickerEditor);
stickerCloseBtn.addEventListener("click", closeStickerEditor);
stickerModal.addEventListener("click", (event) => {
  if (event.target === stickerModal) closeStickerEditor();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!stickerModal.hidden) {
    closeStickerEditor();
    return;
  }
  if (!cropModal.hidden) closeCropper();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("name").value.trim();
  if (!name) {
    alert("이름을 입력해 주세요.");
    $("name").focus();
    return;
  }
  if (selectedGenres.size === 0) {
    alert("주력 장르를 하나 이상 선택해 주세요.");
    genreList.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (stampMode === "custom") {
    const customText = customStampText.value.trim();
    if (!customText) {
      alert("커스텀 도장 문구를 입력해 주세요.");
      customStampText.focus();
      return;
    }
    currentStamp = [...customText].slice(0, 8).join("");
  } else {
    currentStamp = randomStamp();
  }
  drawCard();
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

rerollStampBtn.addEventListener("click", () => {
  if (stampMode === "custom") {
    const customText = customStampText.value.trim();
    if (!customText) {
      alert("커스텀 도장 문구를 입력해 주세요.");
      return;
    }
    currentStamp = [...customText].slice(0, 8).join("");
  } else {
    currentStamp = randomStamp(currentStamp);
  }
  drawCard();
});

downloadBtn.addEventListener("click", () => {
  const name = $("name").value.trim() || "resident";
  const safeName = name.replace(/[\\/:*?"<>|]/g, "_");
  const fileName = `만화마을_주민등록증_${safeName}.png`;
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => a.remove(), 1500);
  } catch (error) {
    console.error("이미지 저장 실패:", error);
    openImageFallback();
  }
});

function ensureImageFile(file) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 선택할 수 있어요.");
  if (file.size > 10 * 1024 * 1024) throw new Error("이미지는 10MB 이하로 선택해 주세요.");
}

function handleImageLoadError(error, inputElement) {
  console.error(error);
  alert(error instanceof Error ? error.message : "이미지를 불러오지 못했습니다.");
  if (inputElement) inputElement.value = "";
}

function setStampColor(color, syncPreset = true) {
  const normalized = normalizeHexColor(color) || DEFAULT_STAMP_COLOR;
  stampColor = normalized;
  stampColorPicker.value = normalized;
  stampColorCode.value = normalized.toUpperCase();

  const buttons = [...stampColorPresetList.querySelectorAll('.stamp-color-btn')];
  buttons.forEach((button) => {
    const isMatch = (button.dataset.color || '').toLowerCase() === normalized.toLowerCase();
    button.classList.toggle('is-selected', syncPreset && isMatch);
  });

  if (!syncPreset) {
    const anySelected = buttons.some((button) => (button.dataset.color || '').toLowerCase() === normalized.toLowerCase());
    if (!anySelected) {
      buttons.forEach((button) => button.classList.remove('is-selected'));
    }
  }

  if (!resultSection.hidden) drawCard();
}

function normalizeHexColor(value) {
  if (!value) return null;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  return null;
}

function isValidHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function refreshStickerSlotUI(index) {
  const slot = stickerSlots[index];
  const sticker = stickers[index];
  if (!slot) return;
  if (sticker.image && sticker.previewSrc) {
    slot.preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = sticker.previewSrc;
    img.alt = `선택된 스티커 ${index + 1}`;
    slot.preview.appendChild(img);
    slot.preview.classList.add("has-image");
    slot.editBtn.disabled = false;
    slot.removeBtn.disabled = false;
  } else {
    slot.preview.innerHTML = "<span>이미지 선택</span>";
    slot.preview.classList.remove("has-image");
    slot.editBtn.disabled = true;
    slot.removeBtn.disabled = true;
  }
}

function collectFormData() {
  const joinYear = $("joinYear").value.trim() || String(new Date().getFullYear());
  const residentNumber = $("residentNumber").value.trim();
  return {
    name: $("name").value.trim(),
    nickname: $("nickname").value.trim(),
    joinYear,
    residentNumber,
    genres: [...selectedGenres],
    favoriteWork: $("favoriteWork").value.trim(),
    favoriteCharacter: $("favoriteCharacter").value.trim(),
    intro: $("intro").value.trim(),
    contact: $("contact").value.trim(),
    showContact: $("showContact").checked,
  };
}

function drawCard() {
  renderCardToContext(ctx, collectFormData(), { stampText: currentStamp, stampColor, stickers, guideIndex: null });
}

function renderStickerEditor() {
  const previewStamp = stampMode === "custom" ? (customStampText.value.trim() || "커스텀") : (currentStamp || "랜덤 도장");
  const stickerList = stickers.map((item, index) => {
    if (index !== activeStickerIndex) return item;
    return { image: stickerDraftImage, previewSrc: stickerDraftPreviewSrc, transform: stickerDraftTransform };
  });
  renderCardToContext(stickerCtx, collectFormData(), { stampText: previewStamp, stampColor, stickers: stickerList, guideIndex: activeStickerIndex });
}

function renderCardToContext(targetCtx, data, options = {}) {
  const { stampText = "", stampColor = DEFAULT_STAMP_COLOR, stickers = [], guideIndex = null } = options;
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  drawBackground(targetCtx);
  drawHeader(targetCtx);
  drawPhoto(targetCtx, profileImage);
  drawIdentity(targetCtx, data);
  drawGenres(targetCtx, data.genres);
  drawFavoriteInfo(targetCtx, data);
  drawStickers(targetCtx, stickers, guideIndex);
  drawIntro(targetCtx, data.intro);
  drawContact(targetCtx, data);
  drawResidentCode(targetCtx, data);
  drawStamp(targetCtx, stampText || "주민", stampColor);
  drawFooter(targetCtx);
}

function drawBackground(targetCtx) {
  targetCtx.fillStyle = "#f7f3e9";
  targetCtx.fillRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  targetCtx.strokeStyle = "#171717";
  targetCtx.lineWidth = 4;
  roundRect(targetCtx, 26, 26, targetCtx.canvas.width - 52, targetCtx.canvas.height - 52, 28);
  targetCtx.stroke();
  targetCtx.fillStyle = "rgba(0,0,0,0.025)";
  for (let y = 52; y < targetCtx.canvas.height - 40; y += 26) {
    targetCtx.fillRect(50, y, targetCtx.canvas.width - 100, 1);
  }
  targetCtx.save();
  targetCtx.translate(820, 210);
  targetCtx.rotate(-0.2);
  targetCtx.fillStyle = "rgba(0,0,0,0.035)";
  targetCtx.font = "900 90px sans-serif";
  targetCtx.fillText("MANGA", -150, 0);
  targetCtx.fillText("VILLAGE", -195, 90);
  targetCtx.restore();
}

function drawHeader(targetCtx) {
  targetCtx.fillStyle = "#171717";
  targetCtx.font = "900 46px sans-serif";
  targetCtx.fillText("만화마을 주민등록증", 66, 90);
  targetCtx.font = "800 17px sans-serif";
  targetCtx.fillText("MANGA VILLAGE RESIDENT CARD", 68, 122);
  targetCtx.fillRect(68, 145, 944, 3);
}

function drawPhoto(targetCtx, image) {
  const x = 70, y = 182, w = 280, h = 360;
  targetCtx.save();
  roundRect(targetCtx, x, y, w, h, 20);
  targetCtx.clip();
  if (image) {
    drawImageCover(targetCtx, image, x, y, w, h);
  } else {
    targetCtx.fillStyle = "#e6e0d5";
    targetCtx.fillRect(x, y, w, h);
    targetCtx.fillStyle = "#8e887f";
    targetCtx.font = "800 24px sans-serif";
    targetCtx.textAlign = "center";
    targetCtx.fillText("PHOTO", x + w / 2, y + h / 2);
    targetCtx.textAlign = "start";
  }
  targetCtx.restore();
  targetCtx.strokeStyle = "#171717";
  targetCtx.lineWidth = 3;
  roundRect(targetCtx, x, y, w, h, 20);
  targetCtx.stroke();
}

function drawIdentity(targetCtx, data) {
  const x = 395;
  targetCtx.fillStyle = "#77736b";
  targetCtx.font = "800 17px sans-serif";
  targetCtx.fillText("NAME", x, 200);
  targetCtx.fillStyle = "#171717";
  targetCtx.font = "900 54px sans-serif";
  targetCtx.fillText(ellipsis(data.name, 11), x, 255);
  if (data.nickname) {
    targetCtx.fillStyle = "#77736b";
    targetCtx.font = "700 23px sans-serif";
    targetCtx.fillText(ellipsis(data.nickname, 18), x, 291);
  }
}

function drawGenres(targetCtx, genres) {
  const x = 395;
  let cursorX = x, cursorY = 338;
  targetCtx.fillStyle = "#77736b";
  targetCtx.font = "800 17px sans-serif";
  targetCtx.fillText("MAIN GENRE", x, 320);
  genres.forEach((genre) => {
    targetCtx.font = "800 19px sans-serif";
    const text = `#${genre}`;
    const width = targetCtx.measureText(text).width + 28;
    if (cursorX + width > 1000) {
      cursorX = x;
      cursorY += 48;
    }
    targetCtx.fillStyle = "#171717";
    roundRect(targetCtx, cursorX, cursorY, width, 36, 18);
    targetCtx.fill();
    targetCtx.fillStyle = "#fff";
    targetCtx.fillText(text, cursorX + 14, cursorY + 24);
    cursorX += width + 10;
  });
}

function drawFavoriteInfo(targetCtx, data) {
  const x = 395, y = 455;
  targetCtx.fillStyle = "#77736b";
  targetCtx.font = "800 16px sans-serif";
  targetCtx.fillText("FAVORITE", x, y);
  targetCtx.fillStyle = "#171717";
  targetCtx.font = "800 22px sans-serif";
  const work = data.favoriteWork || "-";
  const character = data.favoriteCharacter || "-";
  targetCtx.fillText(`작품  ${ellipsis(work, 21)}`, x, y + 34);
  targetCtx.fillText(`최애  ${ellipsis(character, 21)}`, x, y + 70);
}

function drawStickers(targetCtx, stickerList, guideIndex = null) {
  stickerList.forEach((sticker, index) => {
    if (!sticker || !sticker.image || !sticker.transform) return;
    drawSticker(targetCtx, sticker.image, sticker.transform, guideIndex === index, index + 1);
  });
}

function drawSticker(targetCtx, image, transform, showGuide = false, label = 1) {
  const size = getStickerSize(image, transform);
  targetCtx.save();
  targetCtx.translate(transform.x, transform.y);
  targetCtx.rotate((transform.rotation * Math.PI) / 180);
  targetCtx.drawImage(image, -size.width / 2, -size.height / 2, size.width, size.height);
  if (showGuide) {
    targetCtx.strokeStyle = "rgba(23,23,23,.9)";
    targetCtx.lineWidth = 3;
    targetCtx.setLineDash([12, 8]);
    targetCtx.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height);
    targetCtx.setLineDash([]);
    targetCtx.fillStyle = "rgba(23,23,23,.9)";
    targetCtx.font = "900 18px sans-serif";
    targetCtx.fillText(`STICKER ${label}`, -size.width / 2, -size.height / 2 - 10);
  }
  targetCtx.restore();
}

function drawIntro(targetCtx, text) {
  const value = text || "만화마을의 새로운 주민입니다.";
  targetCtx.fillStyle = "#171717";
  targetCtx.font = "800 23px sans-serif";
  drawWrappedText(targetCtx, `“${value}”`, 70, 595, 660, 31, 2);
}

function drawContact(targetCtx, data) {
  targetCtx.fillStyle = "#77736b";
  targetCtx.font = "800 14px sans-serif";
  targetCtx.fillText("CONTACT", 745, 568);
  targetCtx.fillStyle = "#171717";
  targetCtx.font = "800 18px sans-serif";
  const contact = data.showContact && data.contact ? ellipsis(data.contact, 23) : "PRIVATE";
  targetCtx.fillText(contact, 745, 594);
}

function drawResidentCode(targetCtx, data) {
  const number = data.residentNumber ? String(data.residentNumber).padStart(3, "0") : String(simpleHash(data.name) % 999 + 1).padStart(3, "0");
  const yy = String(data.joinYear).slice(-2);
  const code = `MM-${yy}-${number}`;
  targetCtx.fillStyle = "#77736b";
  targetCtx.font = "800 14px sans-serif";
  targetCtx.fillText("RESIDENT CODE", 745, 620);
  targetCtx.fillStyle = "#171717";
  targetCtx.font = "900 22px monospace";
  targetCtx.fillText(code, 745, 648);
}

function drawStamp(targetCtx, text, color = DEFAULT_STAMP_COLOR) {
  const x = 920, y = 463;
  targetCtx.save();
  targetCtx.translate(x, y);
  targetCtx.rotate(-0.12);
  targetCtx.strokeStyle = color;
  targetCtx.lineWidth = 5;
  targetCtx.globalAlpha = 0.78;
  targetCtx.beginPath();
  targetCtx.arc(0, 0, 74, 0, Math.PI * 2);
  targetCtx.stroke();
  targetCtx.beginPath();
  targetCtx.arc(0, 0, 62, 0, Math.PI * 2);
  targetCtx.stroke();
  targetCtx.fillStyle = color;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "middle";
  drawStampText(targetCtx, text);
  targetCtx.restore();
}

function drawStampText(targetCtx, text) {
  const maxWidth = 104;
  const cleanText = [...String(text).trim()].slice(0, 8).join("") || "주민";
  let fontSize = 19;
  while (fontSize >= 13) {
    targetCtx.font = `900 ${fontSize}px sans-serif`;
    if (targetCtx.measureText(cleanText).width <= maxWidth) {
      targetCtx.fillText(cleanText, 0, 1);
      return;
    }
    fontSize -= 1;
  }
  const words = cleanText.split(/\s+/).filter(Boolean);
  let lines;
  if (words.length >= 2) {
    let bestScore = Infinity;
    lines = [words[0], words.slice(1).join(" ")];
    for (let i = 1; i < words.length; i += 1) {
      const line1 = words.slice(0, i).join(" ");
      const line2 = words.slice(i).join(" ");
      targetCtx.font = "900 17px sans-serif";
      const score = Math.abs(targetCtx.measureText(line1).width - targetCtx.measureText(line2).width);
      if (score < bestScore) {
        bestScore = score;
        lines = [line1, line2];
      }
    }
  } else {
    const chars = [...cleanText];
    const splitAt = Math.ceil(chars.length / 2);
    lines = [chars.slice(0, splitAt).join(""), chars.slice(splitAt).join("")];
  }
  fontSize = 17;
  while (fontSize >= 11) {
    targetCtx.font = `900 ${fontSize}px sans-serif`;
    if (lines.every((line) => targetCtx.measureText(line).width <= maxWidth)) break;
    fontSize -= 1;
  }
  const lineHeight = fontSize + 5;
  targetCtx.font = `900 ${fontSize}px sans-serif`;
  targetCtx.fillText(lines[0], 0, -lineHeight / 2);
  if (lines[1]) targetCtx.fillText(lines[1], 0, lineHeight / 2);
}

function drawFooter(targetCtx) {
  targetCtx.fillStyle = "#171717";
  targetCtx.font = "900 13px sans-serif";
  targetCtx.fillText("만화마을 주민센터", 70, 648);
  targetCtx.textAlign = "right";
  targetCtx.fillText("MANGA VILLAGE · 2026", 1008, 648);
  targetCtx.textAlign = "start";
}

function openCropper(image) {
  cropBaseScale = Math.max(cropCanvas.width / image.width, cropCanvas.height / image.height);
  cropScale = cropBaseScale;
  cropZoom.value = "1";
  const drawW = image.width * cropScale;
  const drawH = image.height * cropScale;
  cropOffsetX = (cropCanvas.width - drawW) / 2;
  cropOffsetY = (cropCanvas.height - drawH) / 2;
  clampCropOffset();
  renderCropper();
  cropModal.hidden = false;
  document.body.classList.add("is-modal-open");
}

function closeCropper() {
  cropModal.hidden = true;
  document.body.classList.remove("is-modal-open");
  cropSourceImage = null;
  cropDragging = false;
  cropPointerId = null;
  cropCanvas.classList.remove("is-dragging");
  photoInput.value = "";
}

function stopCropDrag(event) {
  if (event.pointerId !== cropPointerId) return;
  cropDragging = false;
  cropPointerId = null;
  cropCanvas.classList.remove("is-dragging");
  try { cropCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
}

function clampCropOffset() {
  if (!cropSourceImage) return;
  const drawW = cropSourceImage.width * cropScale;
  const drawH = cropSourceImage.height * cropScale;
  const minX = cropCanvas.width - drawW;
  const minY = cropCanvas.height - drawH;
  cropOffsetX = Math.min(0, Math.max(minX, cropOffsetX));
  cropOffsetY = Math.min(0, Math.max(minY, cropOffsetY));
}

function renderCropper() {
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.fillStyle = "#111";
  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  if (!cropSourceImage) return;
  drawCropImage(cropCtx);
  cropCtx.save();
  cropCtx.strokeStyle = "rgba(255,255,255,.44)";
  cropCtx.lineWidth = 2;
  for (const ratio of [1 / 3, 2 / 3]) {
    cropCtx.beginPath();
    cropCtx.moveTo(cropCanvas.width * ratio, 0);
    cropCtx.lineTo(cropCanvas.width * ratio, cropCanvas.height);
    cropCtx.stroke();
    cropCtx.beginPath();
    cropCtx.moveTo(0, cropCanvas.height * ratio);
    cropCtx.lineTo(cropCanvas.width, cropCanvas.height * ratio);
    cropCtx.stroke();
  }
  cropCtx.restore();
  cropCtx.save();
  cropCtx.strokeStyle = "rgba(255,255,255,.9)";
  cropCtx.lineWidth = 8;
  cropCtx.strokeRect(4, 4, cropCanvas.width - 8, cropCanvas.height - 8);
  cropCtx.restore();
}

function drawCropImage(targetCtx) {
  if (!cropSourceImage) return;
  const drawW = cropSourceImage.width * cropScale;
  const drawH = cropSourceImage.height * cropScale;
  targetCtx.drawImage(cropSourceImage, cropOffsetX, cropOffsetY, drawW, drawH);
}

function createDefaultStickerTransform(index) {
  const presets = [
    { x: 820, y: 560, rotation: -8 },
    { x: 920, y: 520, rotation: 8 },
    { x: 990, y: 550, rotation: -4 },
  ];
  const preset = presets[index] || presets[0];
  return { x: preset.x, y: preset.y, scale: 1, rotation: preset.rotation };
}

function openStickerEditor(index) {
  if (!stickerDraftImage || !stickerDraftTransform) return;
  stickerEditingLabel.textContent = `스티커 ${index + 1} 편집 중 · 드래그로 위치 이동, 슬라이더로 크기 / 회전 조절`;
  stickerScaleInput.value = String(stickerDraftTransform.scale);
  stickerRotationInput.value = String(stickerDraftTransform.rotation);
  clampStickerTransform(stickerDraftTransform, stickerDraftImage);
  renderStickerEditor();
  stickerModal.hidden = false;
  document.body.classList.add("is-modal-open");
}

function closeStickerEditor() {
  stickerModal.hidden = true;
  document.body.classList.remove("is-modal-open");
  stickerDragging = false;
  stickerPointerId = null;
  stickerCanvas.classList.remove("is-dragging");
  activeStickerIndex = null;
  stickerDraftImage = null;
  stickerDraftPreviewSrc = "";
  stickerDraftTransform = null;
}

function stopStickerDrag(event) {
  if (event.pointerId !== stickerPointerId) return;
  stickerDragging = false;
  stickerPointerId = null;
  stickerCanvas.classList.remove("is-dragging");
  try { stickerCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
}

function getStickerSize(image, transform) {
  const longer = Math.max(image.width, image.height) || 1;
  const baseRatio = STICKER_BASE_SIZE / longer;
  return { width: image.width * baseRatio * transform.scale, height: image.height * baseRatio * transform.scale };
}

function getStickerBounds(image, transform) {
  const size = getStickerSize(image, transform);
  const rad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = size.width / 2;
  const halfH = size.height / 2;
  return {
    bboxHalfW: Math.abs(halfW * cos) + Math.abs(halfH * sin),
    bboxHalfH: Math.abs(halfW * sin) + Math.abs(halfH * cos),
  };
}

function clampStickerTransform(transform, image) {
  if (!transform || !image) return;
  const bounds = getStickerBounds(image, transform);
  transform.x = Math.max(CARD_PADDING + bounds.bboxHalfW, Math.min(1080 - CARD_PADDING - bounds.bboxHalfW, transform.x));
  transform.y = Math.max(CARD_PADDING + bounds.bboxHalfH, Math.min(680 - CARD_PADDING - bounds.bboxHalfH, transform.y));
}

function pointInsideSticker(x, y, image, transform) {
  const size = getStickerSize(image, transform);
  const rad = (-transform.rotation * Math.PI) / 180;
  const dx = x - transform.x;
  const dy = y - transform.y;
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(localX) <= size.width / 2 && Math.abs(localY) <= size.height / 2;
}

function getCanvasPoint(targetCanvas, event) {
  const rect = targetCanvas.getBoundingClientRect();
  const scaleX = targetCanvas.width / rect.width;
  const scaleY = targetCanvas.height / rect.height;
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

function setStampMode(mode) {
  stampMode = mode;
  const isRandom = mode === "random";
  stampRandomModeBtn.classList.toggle("is-active", isRandom);
  stampCustomModeBtn.classList.toggle("is-active", !isRandom);
  stampRandomPanel.hidden = !isRandom;
  stampCustomPanel.hidden = isRandom;
  rerollStampBtn.textContent = isRandom ? "도장 다시 뽑기" : "커스텀 도장 적용";
}

function randomStamp(exclude = "") {
  const pool = stamps.filter((stamp) => stamp !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

function openImageFallback() {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const popup = window.open("", "_blank");
    if (!popup) {
      alert("이미지 저장이 차단되었습니다. 생성된 이미지를 길게 눌러 저장하거나 브라우저의 팝업/다운로드 허용 설정을 확인해 주세요.");
      return;
    }
    popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>만화마을 주민등록증</title><style>body{margin:0;padding:20px;background:#111;color:white;font-family:sans-serif;text-align:center;}p{line-height:1.6;font-size:14px;}img{display:block;width:100%;max-width:720px;height:auto;margin:18px auto 0;border-radius:12px;}</style></head><body><p>이미지를 길게 눌러 <strong>이미지 저장</strong>을 선택해 주세요.</p><img src="${dataUrl}" alt="만화마을 주민등록증" /></body></html>`);
    popup.document.close();
  } catch (error) {
    console.error("이미지 열기 실패:", error);
    alert("이미지를 열지 못했습니다. 브라우저를 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.");
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(targetCtx, image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;
  let sx = 0, sy = 0, sw = image.width, sh = image.height;
  if (imageRatio > boxRatio) {
    sw = image.height * boxRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / boxRatio;
    sy = (image.height - sh) / 2;
  }
  targetCtx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function roundRect(targetCtx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  targetCtx.beginPath();
  targetCtx.moveTo(x + r, y);
  targetCtx.arcTo(x + width, y, x + width, y + height, r);
  targetCtx.arcTo(x + width, y + height, x, y + height, r);
  targetCtx.arcTo(x, y + height, x, y, r);
  targetCtx.arcTo(x, y, x + width, y, r);
  targetCtx.closePath();
}

function drawWrappedText(targetCtx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const chars = [...text];
  const lines = [];
  let line = "";
  chars.forEach((char) => {
    const test = line + char;
    if (targetCtx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  const output = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    output[maxLines - 1] = ellipsis(output[maxLines - 1], Math.max(2, output[maxLines - 1].length - 1));
  }
  output.forEach((item, index) => {
    targetCtx.fillText(item, x, y + index * lineHeight);
  });
}

function ellipsis(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}…` : text;
}

function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

setStampColor(DEFAULT_STAMP_COLOR, true);
