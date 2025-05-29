// weatherRecommendationSystem.js

// Activity profiles define how sensitive each activity is to different weather factors
const ACTIVITY_PROFILES = {
  general: {
    name: 'General',
    tempRange: { ideal: [65, 75], comfortable: [55, 82], tolerable: [45, 88] },
    windSensitivity: 1.0,
    humiditySensitivity: 1.0,
    sunRequirement: 'neutral', // 'high', 'neutral', 'low'
    wetnessTolerance: 'low',
  },
  walking: {
    name: 'Walking',
    tempRange: { ideal: [60, 75], comfortable: [50, 80], tolerable: [40, 85] },
    windSensitivity: 0.8,
    humiditySensitivity: 0.9,
    sunRequirement: 'neutral',
    wetnessTolerance: 'medium',
  },
  running_sport: {
    name: 'Running/Sport',
    tempRange: { ideal: [45, 65], comfortable: [35, 75], tolerable: [25, 85] },
    windSensitivity: 0.6,
    humiditySensitivity: 1.5, // More sensitive to humidity
    sunRequirement: 'low',
    wetnessTolerance: 'high',
    tempAdjustment: -7, // Feels warmer when active
  },
  eating_outside: {
    name: 'Eating Outside',
    tempRange: { ideal: [68, 78], comfortable: [62, 82], tolerable: [55, 88] },
    windSensitivity: 1.5, // More sensitive to wind when sitting still
    humiditySensitivity: 1.1,
    sunRequirement: 'neutral',
    wetnessTolerance: 'very_low',
  },
  pool_lounging: {
    name: 'Lounging by Pool',
    tempRange: { ideal: [78, 88], comfortable: [73, 92], tolerable: [68, 95] },
    windSensitivity: 1.3, // Wind + wet = cold
    humiditySensitivity: 0.7, // Less bothered by humidity
    sunRequirement: 'high',
    wetnessTolerance: 'high',
  },
};

// Clothing recommendations based on temperature ranges
const CLOTHING_TEMPLATES = {
  very_cold: {
    range: [-999, 45],
    general: "Bundle up: heavy winter coat, hat, and gloves essential",
    running_sport: "Warm active wear with multiple layers and protect extremities",
  },
  cold: {
    range: [45, 55],
    general: "A heavy jacket, possibly with layers, is needed",
    running_sport: "Standard active wear with warm layers",
  },
  chilly: {
    range: [55, 62],
    general: "Wear a medium jacket or coat",
    running_sport: "Light active wear with optional light layer",
  },
  cool: {
    range: [62, 68],
    general: "A light jacket or long sleeves",
    running_sport: "Standard active wear",
  },
  mild: {
    range: [68, 75],
    general: "Short sleeves should be fine",
    running_sport: "Light, breathable active wear",
    pool_lounging: "Borderline for pool - consider if you're feeling brave",
  },
  warm: {
    range: [75, 82],
    general: "Light clothing recommended",
    running_sport: "Minimal active wear, stay hydrated",
    pool_lounging: "Perfect pool weather! Swimwear and sun protection",
  },
  hot: {
    range: [82, 88],
    general: "Dress light and stay cool",
    running_sport: "Minimal clothing, hydrate extensively",
    pool_lounging: "Ideal for the pool, but seek shade during peak hours",
  },
  very_hot: {
    range: [88, 999],
    general: "Minimal clothing recommended",
    running_sport: "Consider indoor exercise or very early/late times",
    pool_lounging: "Pool time! But be careful of sun exposure",
  },
};

// Weather condition modifiers
const WEATHER_MODIFIERS = {
  windy: {
    threshold: 10,
    severe: 15,
    templates: {
      mild: "but it's breezy",
      strong: "and it's quite windy",
      severe: "with strong winds making it feel cooler",
    },
  },
  humid: {
    threshold: 65,
    severe: 80,
    templates: {
      mild: "with noticeable humidity",
      strong: "and it's quite humid",
      severe: "with oppressive humidity",
    },
  },
  dry: {
    threshold: 30, // Below this is dry
    templates: {
      mild: "with dry air",
      severe: "with very dry conditions - stay hydrated",
    },
  },
  cloudy: {
    threshold: 60,
    severe: 80,
    templates: {
      mild: "with some cloud cover",
      strong: "under cloudy skies",
      severe: "with heavy overcast",
    },
  },
  sunny: {
    threshold: 30, // Below this cloud cover
    templates: {
      mild: "with good sun exposure",
      strong: "under bright sunshine",
    },
  },
};

// Activity-specific warnings and advice
const ACTIVITY_WARNINGS = {
  pool_lounging: {
    too_cold: {
      threshold: 68,
      message: "Too cold for comfortable pool lounging",
    },
    perfect: {
      min: 73,
      sunny: true,
      message: "Perfect for the pool!",
    },
    windy_wet: {
      windThreshold: 12,
      tempThreshold: 80,
      message: "Wind might make it feel quite cold when wet",
    },
  },
  running_sport: {
    extreme_heat: {
      threshold: 85,
      humidityThreshold: 65,
      message: "Very strenuous conditions for exercise - consider lighter workout or indoor option",
    },
    cold_wind: {
      tempThreshold: 40,
      windThreshold: 10,
      message: "Protect against wind chill during your run",
    },
  },
  eating_outside: {
    too_cold: {
      threshold: 55,
      message: "Too chilly for comfortable outdoor dining",
    },
    too_windy: {
      threshold: 15,
      message: "Wind might be disruptive for eating outside",
    },
    windy_cold: {
      windThreshold: 12,
      tempThreshold: 70,
      message: "Wind will make it feel cooler - seek a sheltered spot",
    },
  },
  walking: {
    hot_humid: {
      tempThreshold: 75,
      humidityThreshold: 70,
      message: "Walking will feel quite sticky",
    },
    hot_sunny: {
      tempThreshold: 80,
      sunny: true,
      message: "Hot day for a walk - take water and sun protection",
    },
  },
};

// Main recommendation engine
class WeatherOutfitRecommender {
  constructor() {
    this.profiles = ACTIVITY_PROFILES;
    this.clothing = CLOTHING_TEMPLATES;
    this.modifiers = WEATHER_MODIFIERS;
    this.warnings = ACTIVITY_WARNINGS;
  }

  getRecommendation(weatherData, activity = 'general') {
    const profile = this.profiles[activity] || this.profiles.general;
    
    // Adjust temperature for activity
    const effectiveTemp = weatherData.temp + (profile.tempAdjustment || 0);
    
    // Get base clothing recommendation
    const clothing = this.getClothingRecommendation(effectiveTemp, activity);
    
    // Check for activity-specific warnings
    const warning = this.getActivityWarning(weatherData, activity);
    
    // Get weather modifiers
    const modifiers = this.getWeatherModifiers(weatherData);
    
    // Assess comfort level
    const comfort = this.assessComfort(effectiveTemp, weatherData, profile);
    
    // Build final recommendation
    return this.buildRecommendation(clothing, warning, modifiers, comfort, weatherData, activity);
  }

  getClothingRecommendation(temp, activity) {
    for (const [key, config] of Object.entries(this.clothing)) {
      if (temp >= config.range[0] && temp < config.range[1]) {
        return config[activity] || config.general;
      }
    }
    return "Dress appropriately for the weather";
  }

  getActivityWarning(weather, activity) {
    const warnings = this.warnings[activity];
    if (!warnings) return null;

    for (const [key, config] of Object.entries(warnings)) {
      if (config.threshold && weather.temp < config.threshold) {
        return config.message;
      }
      if (config.min && weather.temp >= config.min && 
          (!config.sunny || weather.isSunny)) {
        return config.message;
      }
      if (config.tempThreshold && config.humidityThreshold &&
          weather.temp > config.tempThreshold && 
          weather.humidity > config.humidityThreshold) {
        return config.message;
      }
      if (config.windThreshold && config.tempThreshold &&
          weather.wind > config.windThreshold && 
          weather.temp < config.tempThreshold) {
        return config.message;
      }
    }
    return null;
  }

  getWeatherModifiers(weather) {
    const mods = [];
    
    // Wind
    if (weather.wind > this.modifiers.windy.severe) {
      mods.push(this.modifiers.windy.templates.severe);
    } else if (weather.wind > this.modifiers.windy.threshold) {
      mods.push(this.modifiers.windy.templates.strong);
    }
    
    // Humidity
    if (weather.humidity > this.modifiers.humid.severe) {
      mods.push(this.modifiers.humid.templates.severe);
    } else if (weather.humidity > this.modifiers.humid.threshold) {
      mods.push(this.modifiers.humid.templates.mild);
    } else if (weather.humidity < this.modifiers.dry.threshold) {
      mods.push(this.modifiers.dry.templates.mild);
    }
    
    // Sun/Clouds
    if (weather.isSunny) {
      mods.push(this.modifiers.sunny.templates.strong);
    } else if (weather.clouds > this.modifiers.cloudy.severe) {
      mods.push(this.modifiers.cloudy.templates.severe);
    } else if (weather.clouds > this.modifiers.cloudy.threshold) {
      mods.push(this.modifiers.cloudy.templates.mild);
    }
    
    return mods;
  }

  assessComfort(temp, weather, profile) {
    const { ideal, comfortable, tolerable } = profile.tempRange;
    
    let score = 0;
    if (temp >= ideal[0] && temp <= ideal[1]) {
      score = 100;
    } else if (temp >= comfortable[0] && temp <= comfortable[1]) {
      score = 75;
    } else if (temp >= tolerable[0] && temp <= tolerable[1]) {
      score = 50;
    } else {
      score = 25;
    }
    
    // Adjust for other factors
    if (weather.wind > 15) score -= 10 * profile.windSensitivity;
    if (weather.humidity > 70) score -= 10 * profile.humiditySensitivity;
    if (profile.sunRequirement === 'high' && !weather.isSunny) score -= 15;
    if (profile.sunRequirement === 'low' && weather.isSunny && temp > 80) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  buildRecommendation(clothing, warning, modifiers, comfort, weather, activity) {
    let message = "";
    
    // Priority: Activity-specific warnings come first
    if (warning && comfort < 50) {
      message = warning + ". ";
      if (activity !== 'general') {
        message += `For general comfort: ${clothing.toLowerCase()}`;
      }
    } else {
      message = clothing;
      if (modifiers.length > 0) {
        message += " " + modifiers[0];
        if (modifiers.length > 1) {
          message += " " + modifiers.slice(1).join(", ");
        }
      }
      message += ".";
      if (warning) {
        message += " " + warning + ".";
      }
    }
    
    // Add comfort indicator for activities
    if (activity !== 'general' && comfort < 60) {
      const profile = this.profiles[activity];
      if (comfort < 30) {
        message += ` Conditions are poor for ${profile.name.toLowerCase()}.`;
      } else if (comfort < 50) {
        message += ` Conditions are marginal for ${profile.name.toLowerCase()}.`;
      }
    }
    
    return message.trim().replace(/\.+/g, '.');
  }

  explainConditions(weather, activity = 'general') {
    const parts = [];
    
    parts.push(`It's ${Math.round(weather.temp)}°F`);
    
    if (weather.humidity > 70) {
      parts.push(`with ${Math.round(weather.humidity)}% humidity`);
    }
    
    if (weather.wind > 5) {
      parts.push(`${Math.round(weather.wind)} mph wind`);
    }
    
    if (weather.clouds > 70) {
      parts.push(`${Math.round(weather.clouds)}% cloud cover`);
    } else if (weather.isSunny) {
      parts.push('sunny');
    }
    
    return parts.join(', ') + '.';
  }
}

// Export the new system
export const weatherRecommender = new WeatherOutfitRecommender();

// Wrapper functions to maintain compatibility with existing code
export const getOutfitAdvice = (weatherData, activity = 'general') => {
  return weatherRecommender.getRecommendation(weatherData, activity);
};

export const explainOutfitAdvice = (weatherData, activity = 'general') => {
  return weatherRecommender.explainConditions(weatherData, activity);
};