// cohi-logic.js

// 1. SMART VALIDATION ENGINE
export const validateSurveyRules = (surveyData) => {
    let errors = [];
    let warnings = [];

    // Rule: Cement render is ONLY for new builds
    if (surveyData.buildCategory === 'Existing Build' && surveyData.brickMatch === 'Cement Render') {
        errors.push("Clash: Cement Render cannot be applied to an Existing Build schedule.");
    }

    // Rule: Enforce strict nomenclature
    if (surveyData.roofSystem && surveyData.roofSystem.toLowerCase().includes('room')) {
        warnings.push("Auto-Correction: Changed 'Edwardian Room' to 'Edwardian Roof' for official documentation.");
        surveyData.roofSystem = "Edwardian Roof"; 
    }

    return { isValid: errors.length === 0, errors, warnings, sanitizedData: surveyData };
};

// 2. AUTO-CALIBRATION MATH ENGINE (For Sniper v3)
export const calibrateSniperPixelsToMM = (drawnPixelLength, realWorldMM) => {
    if (!drawnPixelLength || !realWorldMM) return 1;
    return realWorldMM / drawnPixelLength; // Returns the scaling factor
};

export const calculateRealWorldDimension = (newLinePixelLength, scaleFactor) => {
    return Math.round(newLinePixelLength * scaleFactor); 
};
