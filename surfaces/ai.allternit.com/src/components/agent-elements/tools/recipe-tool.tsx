import { memo } from "react";
import { IconChefHat, IconClock, IconUsers, IconFlame } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { cn } from "../utils/cn";

export type RecipeIngredient = {
  name: string;
  amount?: string;
  unit?: string;
};

export type RecipeStep = {
  step: number;
  instruction: string;
  duration?: string;
};

export type Recipe = {
  name?: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  difficulty?: string;
  calories?: string;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tags?: string[];
};

export type RecipeToolProps = {
  part: {
    id?: string;
    toolCallId?: string;
    type?: string;
    state?: string;
    input?: Record<string, unknown>;
    args?: Record<string, unknown>;
    output?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
  defaultOpen?: boolean;
};

function normalizeRecipe(value: unknown): Recipe | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;

  const ingredients = Array.isArray(v.ingredients)
    ? v.ingredients
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const i = item as Record<string, unknown>;
          const name = typeof i.name === "string" ? i.name : typeof i.ingredient === "string" ? i.ingredient : undefined;
          if (!name) return null;
          return {
            name,
            amount: typeof i.amount === "string" ? i.amount : undefined,
            unit: typeof i.unit === "string" ? i.unit : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;

  const steps = Array.isArray(v.steps)
    ? v.steps
        .map((item, idx) => {
          if (!item || typeof item !== "object") return null;
          const s = item as Record<string, unknown>;
          const instruction =
            typeof s.instruction === "string"
              ? s.instruction
              : typeof s.step === "string"
                ? s.step
                : typeof s.description === "string"
                  ? s.description
                  : undefined;
          if (!instruction) return null;
          return {
            step: typeof s.step === "number" ? s.step : idx + 1,
            instruction,
            duration: typeof s.duration === "string" ? s.duration : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;

  return {
    name: typeof v.name === "string" ? v.name : typeof v.title === "string" ? v.title : undefined,
    description: typeof v.description === "string" ? v.description : undefined,
    prepTime: typeof v.prepTime === "string" ? v.prepTime : undefined,
    cookTime: typeof v.cookTime === "string" ? v.cookTime : undefined,
    servings: typeof v.servings === "number" ? v.servings : undefined,
    difficulty: typeof v.difficulty === "string" ? v.difficulty : undefined,
    calories: typeof v.calories === "string" ? v.calories : undefined,
    ingredients,
    steps,
    tags: Array.isArray(v.tags) ? v.tags.filter((s): s is string => typeof s === "string") : undefined,
  };
}

export const RecipeTool = memo(function RecipeTool({
  part,
  defaultOpen = true,
}: RecipeToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error";

  const recipe =
    normalizeRecipe(part.output) ??
    normalizeRecipe(part.result) ??
    normalizeRecipe(part.input) ??
    normalizeRecipe(part.args) ??
    {};

  const hasContent = !!recipe.name || !!(recipe.ingredients && recipe.ingredients.length > 0);

  return (
    <ToolRowBase
      icon={<IconChefHat className="w-full h-full text-muted-foreground" />}
      shimmerLabel="Creating recipe..."
      completeLabel={recipe.name || "Recipe created"}
      isAnimating={isPending}
      expandable={hasContent}
      defaultOpen={defaultOpen}
    >
      <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-an-tool-border-color bg-background/50">
          <div className="flex items-center gap-2">
            <IconChefHat className="size-4  text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {recipe.name || "Recipe"}
            </span>
          </div>
          {recipe.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{recipe.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {recipe.prepTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconClock className="size-3 " />
                <span>Prep: {recipe.prepTime}</span>
              </div>
            )}
            {recipe.cookTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconFlame className="size-3 " />
                <span>Cook: {recipe.cookTime}</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconUsers className="size-3 " />
                <span>Serves {recipe.servings}</span>
              </div>
            )}
            {recipe.difficulty && (
              <span className="text-xs uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {recipe.difficulty}
              </span>
            )}
          </div>
        </div>

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="p-3 border-b border-an-tool-border-color">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Ingredients
            </h4>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="size-1  rounded-full bg-primary/60 shrink-0 mt-2" />
                  <span className="text-foreground">
                    {ing.amount && <span className="font-medium">{ing.amount}</span>}{" "}
                    {ing.unit && <span className="text-muted-foreground">{ing.unit}</span>}{" "}
                    {ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {recipe.steps && recipe.steps.length > 0 && (
          <div className="p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Instructions
            </h4>
            <ol className="space-y-2">
              {recipe.steps.map((s) => (
                <li key={s.step} className="flex gap-2.5 text-sm">
                  <span className="flex items-center justify-center size-5  rounded-full bg-primary/10 text-primary text-[12px] font-semibold shrink-0 mt-0.5">
                    {s.step}
                  </span>
                  <div className="flex-1">
                    <p className="text-foreground leading-relaxed">{s.instruction}</p>
                    {s.duration && (
                      <span className="text-[12px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <IconClock className="size-3 " />
                        {s.duration}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="px-3 pb-3 flex flex-wrap gap-1">
            {recipe.tags.map((tag, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </ToolRowBase>
  );
});
