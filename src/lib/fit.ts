import {
  Encoder,
  Profile,
  type FileIdMesg,
  type WorkoutMesg,
  type WorkoutStepMesg,
} from "@garmin/fitsdk";
import {
  buildWorkout,
  paces,
  type Intensity,
  type Profile as RunProfile,
  type Session,
  type Week,
} from "@/engine";

/**
 * Entraînement structuré au format FIT (Garmin et la plupart des montres) pour une séance de
 * course : échauffement, répétitions avec récupération, retour au calme, avec une plage
 * d'allure par bloc quand le temps de référence sur 5 km est connu.
 */

const TEST_DISTANCE_M: Record<string, number | null> = {
  "5k": 5000,
  "10k": 10000,
  semi: 21097,
  trail: null,
};

/** Plage de vitesse en mm/s (unité brute FIT) pour une intensité, ou `null` (au ressenti). */
function speedRange(profile: RunProfile, intensity: Intensity): [number, number] | null {
  if (!profile.reference5kSec || intensity === "marche") return null;
  const p = paces(profile.reference5kSec, profile.goal);
  const range = intensity === "objectif" ? p.objectif : p[intensity];
  if (!range) return null;
  // Une allure (s/km) plus lente donne une vitesse plus basse : la borne basse vient de l'allure lente.
  return [Math.round(1_000_000 / range[1]), Math.round(1_000_000 / range[0])];
}

interface Step {
  wktStepName: string;
  durationType: "time" | "distance" | "open" | "repeatUntilStepsCmplt";
  durationValue?: number;
  targetType: "speed" | "open";
  targetValue?: number;
  customTargetValueLow?: number;
  customTargetValueHigh?: number;
  intensity?: "active" | "rest" | "warmup" | "cooldown" | "recovery" | "interval";
}

function targetFor(
  profile: RunProfile,
  intensity: Intensity,
): Pick<Step, "targetType" | "targetValue" | "customTargetValueLow" | "customTargetValueHigh"> {
  const r = speedRange(profile, intensity);
  return r
    ? {
        targetType: "speed",
        targetValue: 0,
        customTargetValueLow: r[0],
        customTargetValueHigh: r[1],
      }
    : { targetType: "open" };
}

/** Étapes FIT d'une séance de course ; `null` pour une séance sans course (renfo, vélo). */
export function workoutSteps(profile: RunProfile, week: Week, session: Session): Step[] | null {
  if (!session.impact) return null;
  const w = buildWorkout(profile, week, session);
  const steps: Step[] = [];
  w.blocks.forEach((b, i) => {
    const first = i === 0 && w.blocks.length > 1;
    const last = i === w.blocks.length - 1 && w.blocks.length > 1;
    const intensity: Step["intensity"] = first
      ? "warmup"
      : last
        ? "cooldown"
        : b.repeat > 1
          ? "interval"
          : "active";
    const name = b.label.slice(0, 15);
    if (b.workSec === 0) {
      // Test : à la distance de l'objectif quand elle est connue.
      const dist = TEST_DISTANCE_M[profile.goal];
      steps.push({
        wktStepName: "Test",
        durationType: dist ? "distance" : "open",
        durationValue: dist ? dist * 100 : undefined, // centimètres
        intensity: "active",
        ...targetFor(profile, b.intensity),
      });
      return;
    }
    const start = steps.length;
    steps.push({
      wktStepName: name,
      durationType: "time",
      durationValue: b.workSec * 1000, // millisecondes
      intensity: b.intensity === "marche" ? "recovery" : intensity,
      ...targetFor(profile, b.intensity),
    });
    if (b.repeat > 1) {
      if (b.recoverySec) {
        steps.push({
          wktStepName: b.recoveryIntensity === "marche" ? "Marche" : "Recup",
          durationType: "time",
          durationValue: b.recoverySec * 1000,
          intensity: "rest",
          ...targetFor(profile, b.recoveryIntensity ?? "endurance"),
        });
      }
      steps.push({
        wktStepName: `x${b.repeat}`,
        durationType: "repeatUntilStepsCmplt",
        durationValue: start, // revient à la première étape du bloc
        targetType: "open",
        targetValue: b.repeat,
      });
    }
  });
  return steps;
}

/** Fichier FIT de l'entraînement, prêt à copier sur la montre ou à importer dans Garmin Connect. */
export function workoutFit(
  profile: RunProfile,
  week: Week,
  session: Session,
  name: string,
  now = new Date(),
): Uint8Array | null {
  const steps = workoutSteps(profile, week, session);
  if (!steps?.length) return null;
  const encoder = new Encoder();
  const fileId: FileIdMesg = {
    type: "workout",
    manufacturer: "development",
    product: 1,
    timeCreated: now,
    serialNumber: 1,
  };
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  const workout: WorkoutMesg = {
    sport: "running",
    numValidSteps: steps.length,
    wktName: name.slice(0, 40),
  };
  encoder.onMesg(Profile.MesgNum.WORKOUT, workout);
  steps.forEach((s, i) => {
    const step: WorkoutStepMesg = { messageIndex: i, ...s };
    encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, step);
  });
  return encoder.close();
}
