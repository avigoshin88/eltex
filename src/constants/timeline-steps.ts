import { SelectOption } from "../types/controls";

const TIMELINE_DIVISION_STEPS = [
  { scale: 0.02, step: 1000, scrollStep: 1000, label: "1 секунда" }, // 1 секунда
  { scale: 0.004, step: 5 * 1000, scrollStep: 5000, label: "5 секунд" }, // 5 секунд
  { scale: 0.002, step: 10 * 1000, scrollStep: 10000, label: "10 секунд" }, // 10 секунд
  { scale: 0.001, step: 20 * 1000, scrollStep: 20000, label: "20 секунд" }, // 20 секунд
  { scale: 0.0005, step: 30 * 1000, scrollStep: 30000, label: "30 секунд" }, // 30 секунд
  {
    scale: 0.0002,
    step: 2 * 60 * 1000,
    scrollStep: 60000,
    label: "1 минута",
  }, // 1 минута
  {
    scale: 0.0001,
    step: 3 * 60 * 1000,
    scrollStep: 120000,
    label: "2 минуты",
  }, // 2 минуты
  {
    scale: 0.00005,
    step: 10 * 60 * 1000,
    scrollStep: 300000,
    label: "5 минут",
  }, // 5 минут
  {
    scale: 0.00002,
    step: 20 * 60 * 1000,
    scrollStep: 600000,
    label: "10 минут",
  }, // 10 минут
  {
    scale: 0.00001,
    step: 30 * 60 * 1000,
    scrollStep: 900000,
    label: "15 минут",
  }, // 15 минут
  {
    scale: 0.000005,
    step: 60 * 60 * 1000,
    scrollStep: 1800000,
    label: "30 минут",
  }, // 30 минут
  {
    scale: 0.000002,
    step: 1 * 90 * 60 * 1000,
    scrollStep: 3600000,
    label: "1 час",
  }, // 1 час
  {
    scale: 0.000001,
    step: 9 * 60 * 60 * 1000,
    scrollStep: 21600000,
    label: "6 часов",
  }, // 6 часов
  {
    scale: 0.0000005,
    step: 14 * 60 * 60 * 1000,
    scrollStep: 43200000,
    label: "12 часов",
  }, // 12 часов
  {
    scale: 0.0000002,
    step: 1 * 24 * 60 * 60 * 1000,
    scrollStep: 86400000,
    label: "1 день",
  }, // 1 день
  {
    scale: 0.0000001,
    step: 2 * 24 * 60 * 60 * 1000,
    scrollStep: 172800000,
    label: "2 дня",
  }, // 2 дня
  {
    scale: 0.00000005,
    step: 7 * 24 * 60 * 60 * 1000,
    scrollStep: 604800000,
    label: "1 неделя",
  }, // 1 неделя
  {
    scale: 0.00000002,
    step: 14 * 24 * 60 * 60 * 1000,
    scrollStep: 1209600000,
    label: "2 недели",
  }, // 2 недели
  {
    scale: 0.00000001,
    step: 1 * 30 * 24 * 60 * 60 * 1000,
    scrollStep: 2592000000,
    label: "1 месяц",
  }, // 1 месяц
  {
    scale: 0.000000005,
    step: 3 * 30 * 24 * 60 * 60 * 1000,
    scrollStep: 7776000000,
    label: "1 квартал",
  }, // 1 квартал
  {
    scale: 0.000000002,
    step: 6 * 30 * 24 * 60 * 60 * 1000,
    scrollStep: 15552000000,
    label: "полгода",
  }, // полгода
  {
    scale: 0.000000001,
    step: 1 * 365 * 24 * 60 * 60 * 1000,
    scrollStep: 31536000000,
    label: "1 год",
  }, // 1 год
  {
    scale: 0.0000000005,
    step: 2 * 365 * 24 * 60 * 60 * 1000,
    scrollStep: 63072000000,
    label: "2 года",
  }, // 2 года
  {
    scale: 0.0000000002,
    step: 5 * 365 * 24 * 60 * 60 * 1000,
    scrollStep: 157680000000,
    label: "5 лет",
  }, // 5 лет
  {
    scale: 0.0000000001,
    step: 10 * 365 * 24 * 60 * 60 * 1000,
    scrollStep: 315360000000,
    label: "10 лет",
  }, // 10 лет
];

// Add more TIMELINE_STEPS for smoother transitions
for (let i = 1; i < TIMELINE_DIVISION_STEPS.length; i++) {
  const prevStep = TIMELINE_DIVISION_STEPS[i - 1];
  const nextStep = TIMELINE_DIVISION_STEPS[i];
  const numIntermediateSteps = 1024 / TIMELINE_DIVISION_STEPS.length;

  for (let j = 1; j < numIntermediateSteps; j++) {
    const scale =
      prevStep.scale +
      ((nextStep.scale - prevStep.scale) / numIntermediateSteps) * j;
    const scrollStep =
      prevStep.scrollStep +
      ((nextStep.scrollStep - prevStep.scrollStep) / numIntermediateSteps) * j;
    TIMELINE_DIVISION_STEPS.splice(i, 0, {
      scale,
      step: prevStep.step,
      scrollStep,
      label: `${prevStep.label} - ${nextStep.label}`,
    });
    i++;
  }
}

const TIMELINE_STEPS_OPTIONS: SelectOption[] = [
  { label: "7д", value: String(7 * 24 * 60 * 60 * 1000) },
  { label: "1д", value: String(1 * 24 * 60 * 60 * 1000) },
  { label: "12ч", value: String(12 * 60 * 60 * 1000) },
  { label: "6ч", value: String(6 * 60 * 60 * 1000) },
  { label: "1ч", value: String(1 * 60 * 60 * 1000) },
  { label: "30мин", value: String(30 * 60 * 1000) },
  { label: "10мин", value: String(10 * 60 * 1000) },
  { label: "5м", value: String(5 * 60 * 1000) },
];

const TIMELINE_MIN_STEP = Number(
  TIMELINE_STEPS_OPTIONS[TIMELINE_STEPS_OPTIONS.length - 1].value
);

export { TIMELINE_DIVISION_STEPS, TIMELINE_STEPS_OPTIONS, TIMELINE_MIN_STEP };
