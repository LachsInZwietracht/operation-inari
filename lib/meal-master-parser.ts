export interface ParsedIngredient {
  amount: string;
  unit: string;
  name: string;
  originalLine: string;
}

export interface ParsedMealMasterRecipe {
  title: string;
  categories: string[];
  servings: number;
  ingredients: ParsedIngredient[];
  instructions: string[];
}

export function parseMealMaster(content: string): ParsedMealMasterRecipe[] {
  const lines = content.split(/\r?\n/);
  const recipes: ParsedMealMasterRecipe[] = [];
  
  let inRecipe = false;
  let currentRecipe: Partial<ParsedMealMasterRecipe> = {};
  let currentSection: "header" | "ingredients" | "instructions" = "header";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for recipe start or end
    if (line.match(/^(?:MMMMM|-----)/) && line.includes("Meal-Master")) {
      if (inRecipe) {
        // Finish current recipe
        if (currentRecipe.title) {
          recipes.push(currentRecipe as ParsedMealMasterRecipe);
        }
        inRecipe = false;
        currentRecipe = {};
      } else {
        // Start new recipe
        inRecipe = true;
        currentRecipe = {
          title: "Importiertes Rezept",
          categories: [],
          servings: 2,
          ingredients: [],
          instructions: []
        };
        currentSection = "header";
      }
      continue;
    }
    
    if (line.match(/^(?:MMMMM|-----)\s*$/)) {
        if (inRecipe) {
            if (currentRecipe.title) {
                recipes.push(currentRecipe as ParsedMealMasterRecipe);
            }
            inRecipe = false;
            currentRecipe = {};
        }
        continue;
    }

    if (!inRecipe) continue;

    // Remove trailing spaces, keep leading for column detection
    const rLine = line.trimEnd();

    if (currentSection === "header") {
      if (rLine.trim() === "") continue; // Skip blank lines in header
      
      const titleMatch = rLine.match(/Title:\s*(.+)/i);
      if (titleMatch) {
        currentRecipe.title = titleMatch[1].trim();
        continue;
      }
      
      const catMatch = rLine.match(/Categories:\s*(.+)/i);
      if (catMatch) {
        currentRecipe.categories = catMatch[1].split(",").map(c => c.trim()).filter(Boolean);
        continue;
      }
      
      const yieldMatch = rLine.match(/Yield:\s*(\d+)/i);
      if (yieldMatch) {
        currentRecipe.servings = parseInt(yieldMatch[1], 10) || 2;
        // After yield, ingredients usually start after a blank line
        currentSection = "ingredients";
        continue;
      }
    }

    if (currentSection === "ingredients" || currentSection === "instructions") {
      // If we see blank lines, it could signify the transition to instructions or just spacing between ingredients.
      if (rLine.trim() === "") {
        if (currentSection === "ingredients" && currentRecipe.ingredients && currentRecipe.ingredients.length > 0) {
            // Once we have ingredients and hit a blank line, subsequent text is often instructions
            currentSection = "instructions";
        }
        continue;
      }

      if (currentSection === "ingredients") {
        // Check if it's formatted as an ingredient (amount unit ingredient)
        // Usually amount is cols 0-6, unit is cols 8-9, ingredient is 11+
        // But let's use a robust regex or column slice.
        
        // Let's try column slicing per standard:
        // Col 0-6: Amount (7 chars)
        // Col 7: Space
        // Col 8-9: Unit (2 chars)
        // Col 10: Space or formatting
        // Col 11+: Ingredient
        
        const amountStr = rLine.substring(0, 7).trim();
        const unitStr = rLine.substring(8, 10).trim();
        const nameStr = rLine.substring(11).trim();

        // If it doesn't fit the strict column format, check if it's an instruction that snuck in
        if (amountStr === "" && unitStr === "" && nameStr !== "") {
            // Might be a continuation line or instruction
            if (rLine.substring(11, 12) === "-") {
                // Continuation of previous ingredient
                if (currentRecipe.ingredients!.length > 0) {
                    currentRecipe.ingredients![currentRecipe.ingredients!.length - 1].name += " " + rLine.substring(12).trim();
                }
            } else {
               // Probably instruction
               currentSection = "instructions";
               currentRecipe.instructions!.push(rLine.trim());
            }
        } else {
            currentRecipe.ingredients!.push({
                amount: amountStr,
                unit: unitStr,
                name: nameStr,
                originalLine: rLine.trim()
            });
        }
      } else if (currentSection === "instructions") {
          currentRecipe.instructions!.push(rLine.trim());
      }
    }
  }
  
  // Clean up instructions (join into paragraphs)
  for (const recipe of recipes) {
      if (recipe.instructions && recipe.instructions.length > 0) {
          // just join them with newlines for now, or keep them as string[]
          // keeping as string[] is fine, but maybe combine lines that aren't separated by blank lines?
          // The standard parser splits by \n anyway.
      }
  }

  return recipes;
}
