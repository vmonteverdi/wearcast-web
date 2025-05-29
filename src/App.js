// App.js
import React, { useState, useEffect, useRef } from 'react';
// MODIFIED: Import from CDN to resolve module resolution error
import { LoadScript, Autocomplete } from 'https://esm.sh/@react-google-maps/api';


// --- API KEYS ---
// TOMORROW_API_KEY is no longer needed for Open-Meteo
const Maps_API_KEY_FOR_PLACES = 'AIzaSyCszLNzNnf2owi36GqJ_awlvpP-KgxqOsA'; // Key for LoadScript (with referrers)
const Maps_API_KEY_FOR_TIMEZONE = 'AIzaSyA_xjKM03OlDDMBj7B-fePmXPzmj5yimAI'; // NEW Key for Time Zone API (no referrers, Time Zone API only)
// --- ---


const activityOptions = [
  { value: 'general', label: 'General' },
  { value: 'walking', label: 'Walking' },
  { value: 'running_sport', label: 'Running/Sport' },
  { value: 'eating_outside', label: 'Eating Outside' },
  { value: 'pool_lounging', label: 'Lounging by Pool' },
];


// ============================================
// WEATHER RECOMMENDATION SYSTEM
// (No changes needed in WeatherOutfitRecommender, ACTIVITY_PROFILES, CLOTHING_TEMPLATES, etc.)
// ============================================
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
    damp: "with a damp, clammy feel",
    muggy: "and it's quite humid",
    oppressive: "with oppressive humidity",
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
      tempThreshold: 85,
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


class WeatherOutfitRecommender {
  constructor() {
    this.profiles = ACTIVITY_PROFILES;
    this.clothing = CLOTHING_TEMPLATES;
    this.modifiers = WEATHER_MODIFIERS;
    this.warnings = ACTIVITY_WARNINGS;
  }


  getRecommendation(weatherData, activity = 'general') {
    const profile = this.profiles[activity] || this.profiles.general;
    const effectiveTemp = weatherData.temp + (profile.tempAdjustment || 0);
    const clothing = this.getClothingRecommendation(effectiveTemp, activity);
    const warning = this.getActivityWarning(weatherData, activity);
    const modifiers = this.getWeatherModifiers(weatherData);
    const comfort = this.assessComfort(effectiveTemp, weatherData, profile);
    return this.buildRecommendation(clothing, warning, modifiers, comfort, weatherData, activity);
  }


  getClothingRecommendation(temp, activity) {
    for (const [, config] of Object.entries(this.clothing)) {
      if (temp >= config.range[0] && temp < config.range[1]) {
        return config[activity] || config.general;
      }
    }
    return "Dress appropriately for the weather";
  }


  getActivityWarning(weather, activity) {
    const warnings = this.warnings[activity];
    if (!warnings) return null;


    // Iterate over keys to use it in the condition for "too_windy"
    for (const key of Object.keys(warnings)) {
      const config = warnings[key];
      if (config.threshold && weather.temp < config.threshold && key !== 'too_windy') { // Avoid double-triggering for too_windy if temp is also low
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
       // Check for specific windy conditions for eating_outside using its own threshold
      if (activity === 'eating_outside' && key === 'too_windy' && config.threshold && weather.wind > config.threshold) {
        return config.message;
      }
    }
    return null;
  }


  getWeatherModifiers(weather) {
  const mods = [];

  if (weather.wind > this.modifiers.windy.severe) {
    mods.push(this.modifiers.windy.templates.severe);
  } else if (weather.wind > this.modifiers.windy.threshold) {
    mods.push(this.modifiers.windy.templates.strong);
  }

  const temp = weather.temp;
  const dewPoint = weather.dewPoint;

  // Updated humidity logic
  if (weather.humidity > 80) {
    if (temp < 60) {
      mods.push(this.modifiers.humid.templates.damp);
    } else if (temp > 75) {
      mods.push(this.modifiers.humid.templates.oppressive);
    } else {
      mods.push(this.modifiers.humid.templates.muggy);
    }
  } else if (weather.humidity > 65 && temp >= 60) {
    mods.push(this.modifiers.humid.templates.muggy);
  } else if (weather.humidity < this.modifiers.dry.threshold) {
    mods.push(this.modifiers.dry.templates.mild);
  }

  // Fog detection
  if (
    weather.humidity >= 90 &&
    weather.clouds > 90 &&
    typeof dewPoint === 'number' &&
    Math.abs(temp - dewPoint) <= 2
  ) {
    mods.push("with possible foggy conditions");
  }

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
    if (weather.wind > 15) score -= 10 * profile.windSensitivity;
    if (weather.humidity > 70) score -= 10 * profile.humiditySensitivity;
    if (profile.sunRequirement === 'high' && !weather.isSunny) score -= 15;
    if (profile.sunRequirement === 'low' && weather.isSunny && temp > 80) score -= 10;
    return Math.max(0, Math.min(100, score));
  }


  buildRecommendation(clothing, warning, modifiers, comfort, weather, activity) {
    let message = "";
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
      if (warning) { // Append warning if not already prioritized
        message += " " + warning + ".";
      }
    }
    if (activity !== 'general' && comfort < 60) {
      const profile = this.profiles[activity];
      if (comfort < 30) {
        message += ` Conditions are poor for ${profile.name.toLowerCase()}.`;
      } else if (comfort < 50) {
        message += ` Conditions are marginal for ${profile.name.toLowerCase()}.`;
      }
    }
    return message.trim().replace(/\.+/g, '.').replace(/\.\s*\./g, '.'); // Consolidate multiple periods
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


  generateDaySummary(bucketData, activity = 'general') {
    const profile = this.profiles[activity] || this.profiles.general;
    const summaryParts = [];
    // Ensure bucketData is not empty and contains avgValues
    if (!bucketData || bucketData.length === 0 || !bucketData.every(b => b && b.avgValues)) {
        return "Insufficient data for day summary.";
    }


    const temps = bucketData.map(b => b.avgValues.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const tempRange = maxTemp - minTemp;
    
    // Ensure bucketData has enough elements before accessing by index
    const morningData = bucketData[0]?.avgValues; // Early Morning
    const middayData = bucketData[2]?.avgValues;  // Mid Day
    const eveningData = bucketData[4]?.avgValues; // Evening


    if (activity === 'pool_lounging') {
      const poolHours = bucketData.filter((b, idx) =>
        // Check if b.avgValues exists
        b.avgValues && idx >= 1 && idx <= 3 && b.avgValues.temp >= 73 && b.avgValues.isSunny // Morning, Mid Day, Afternoon
      );
      if (poolHours.length === 0) {
        summaryParts.push("Not ideal pool weather today");
        if (maxTemp < 68) {
          summaryParts.push("- temperatures stay too cool throughout the day");
        } else if (!bucketData.some(b => b.avgValues && b.avgValues.isSunny)) {
          summaryParts.push("- lack of sunshine makes it less appealing");
        }
      } else {
const start = poolHours[0].label;
const end = poolHours[poolHours.length - 1].label;
if (start === end) {
  summaryParts.push(`Pool conditions look good during ${start}`);
} else {
  summaryParts.push(`Pool conditions look good from ${start} through ${end}`);
}
        if (morningData && morningData.temp < 70) {
          summaryParts.push("Wait until mid-morning for comfortable swimming");
        }
      }
    } else if (activity === 'running_sport') {
      const bestRunTimes = bucketData.filter((b) => {
        // Check if b.avgValues exists
        if (!b.avgValues) return false;
        const temp = b.avgValues.temp;
        const humidity = b.avgValues.humidity;
        return temp < 75 && (temp < 70 || humidity < 70);
      });
      if (bestRunTimes.length === 0) {
        summaryParts.push("Challenging conditions for outdoor exercise all day");
        summaryParts.push("Consider indoor alternatives or hydrate extensively");
      } else {
        summaryParts.push(`Best running conditions during ${bestRunTimes.map(b => b.label).join(', ')}`);
        if (middayData && middayData.temp > 80) {
          summaryParts.push("Avoid midday heat");
        }
      }
    } else if (activity === 'eating_outside') {
      const goodDiningTimes = bucketData.filter(b =>
        // Check if b.avgValues exists
        b.avgValues && b.avgValues.temp >= 62 && b.avgValues.temp <= 82 && b.avgValues.wind < 15
      );
      if (goodDiningTimes.length === 0) {
        summaryParts.push("Outdoor dining might be uncomfortable today");
      } else {
        summaryParts.push(`Pleasant for outdoor dining during ${goodDiningTimes[0].label} to ${goodDiningTimes[goodDiningTimes.length - 1].label}`);
        if (bucketData.some(b => b.avgValues && b.avgValues.wind > 12)) {
          summaryParts.push("Some periods may be breezy - choose sheltered spots");
        }
      }
    } else { // General activity
      if (morningData) {
        const morningClothing = this.getClothingRecommendation(morningData.temp, activity);
        if (morningData.temp < 60) {
          summaryParts.push(`Chilly morning requiring ${morningClothing.toLowerCase()}`);
        } else if (morningData.humidity > 70) {
          summaryParts.push("Humid morning conditions");
        }
      }
      if (middayData && morningData) {
        if (middayData.isSunny && !morningData.isSunny) {
          summaryParts.push("Clouds clear by midday bringing sunshine");
        } else if (!middayData.isSunny && morningData.isSunny) {
          summaryParts.push("Clouds build during the day");
        }
        if (Math.abs(middayData.temp - morningData.temp) > 15) {
          summaryParts.push(`Significant warming from morning (${Math.round(morningData.temp)}°F) to afternoon (${Math.round(middayData.temp)}°F)`);
        }
      }
      if (eveningData) {
        if (eveningData.wind > 10 && eveningData.temp < 65) {
          summaryParts.push("Evening brings wind chill - have a layer handy");
        } else if (eveningData.temp < 60) {
          summaryParts.push("Cooling off in the evening");
        }
      }
    }


    if (activity === 'general' || activity === 'walking') {
      if (tempRange > 15) {
        summaryParts.push("Layer up - you'll want to adjust throughout the day");
      } else if (maxTemp > 75 && minTemp < 65) {
        summaryParts.push("Consider bringing a light layer for cooler parts of the day");
      }
    }
    if (summaryParts.length === 0) return "General conditions are moderate for the day."; // Default summary if no specific advice generated
    return summaryParts.filter(Boolean).join('. ') + '.';
  }
}


const weatherRecommender = new WeatherOutfitRecommender();


const getOutfitAdvice = (weatherData, activity = 'general') => {
  return weatherRecommender.getRecommendation(weatherData, activity);
};


const explainOutfitAdvice = (weatherData, activity = 'general') => {
  return weatherRecommender.explainConditions(weatherData, activity);
};


const getDaySummary = (bucketData, activity = 'general') => {
  return weatherRecommender.generateDaySummary(bucketData, activity);
};


// ============================================
// MAIN APP COMPONENT
// ============================================


const LocationSearch = ({ onSelect }) => {
  const autocompleteRef = useRef(null);
  const [isMapsApiLoaded, setIsMapsApiLoaded] = useState(false);


  const handlePlaceChanged = () => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place || !place.geometry || !place.geometry.location) return;
    const lat = place.geometry.location.lat();
    const lon = place.geometry.location.lng();
    const name = place.formatted_address || place.name || 'Selected location';
    if (typeof onSelect === 'function') {
      onSelect({ lat, lon, name });
    }
  };
  
  // The LoadScript component will set window.google when loaded.
  // We can use an effect to monitor this.
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsMapsApiLoaded(true);
        clearInterval(interval);
      }
    }, 100); // Check every 100ms
    return () => clearInterval(interval);
  }, []);




  return (
    // The LoadScript component handles loading the Google Maps script.
    // The `libraries` prop specifies which additional libraries to load (e.g., 'places').
    <LoadScript 
        googleMapsApiKey={Maps_API_KEY_FOR_PLACES} 
        libraries={['places']}
        onLoad={() => setIsMapsApiLoaded(true)} // Alternative way to detect load
    >
      {/* Autocomplete should only render once the places library is loaded */}
      {isMapsApiLoaded ? (
        <Autocomplete 
            onLoad={(ref) => (autocompleteRef.current = ref)} 
            onPlaceChanged={handlePlaceChanged}
        >
          <input
            type="text"
            placeholder="Search for a location"
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '1rem' }}
          />
        </Autocomplete>
      ) : (
        <input
            type="text"
            placeholder="Loading location search..."
            disabled
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '1rem' }}
        />
      )}
    </LoadScript>
  );
};


const App = () => {
  const [location, setLocation] = useState({
    lat: 34.0522,
    lon: -118.2437,
    name: 'Los Angeles, CA, USA'
  });
  const [forecast, setForecast] = useState([]);
  const [timezoneId, setTimezoneId] = useState('America/Los_Angeles');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedActivities, setSelectedActivities] = useState({});


  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const fetchForecastAndZone = async () => {
      if (!location.lat || !location.lon) {
        setError("Location coordinates are missing.");
        setIsLoading(false); setForecast([]); return;
      }
      
      if (!Maps_API_KEY_FOR_TIMEZONE || (Maps_API_KEY_FOR_TIMEZONE.includes("YOUR_") || Maps_API_KEY_FOR_TIMEZONE.includes("_KEY_"))) {
        setError("Google Maps API Key for Timezone appears to be a placeholder or invalid.");
        setIsLoading(false); setForecast([]); return;
      }
       if (!Maps_API_KEY_FOR_PLACES || (Maps_API_KEY_FOR_PLACES.includes("YOUR_") || Maps_API_KEY_FOR_PLACES.includes("_KEY_"))) {
        setError("Google Maps API Key for Places appears to be a placeholder or invalid.");
        setIsLoading(false); setForecast([]); return;
      }




      const weatherParams = [
        "apparent_temperature",
        "temperature_2m",
        "dew_point_2m",
        "wind_speed_10m",
        "cloud_cover",
        "relative_humidity_2m"
      ].join(',');
      
      // FIXED: Add timezone parameter to Open Meteo API call
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&hourly=${weatherParams}&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=7`;

      console.log('Fetching weather from:', weatherUrl);


      try {
        // Fetch weather data
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
            const errorData = await weatherRes.json().catch(() => ({})); // Try to parse error, default to empty obj
            throw new Error(`Weather API request failed: ${weatherRes.statusText} (status ${weatherRes.status}) - ${errorData.reason || 'Unknown error'}`);
        }
        const weatherData = await weatherRes.json();


        if (weatherData && weatherData.hourly && weatherData.hourly.time && weatherData.hourly.time.length > 0) {
          const transformedForecast = weatherData.hourly.time.map((timeISO, index) => {
            // Helper to safely access array elements
            const getValue = (arr, idx) => (arr && arr.length > idx ? arr[idx] : null);
            return {
              time: timeISO, 
              values: {
                temperatureApparent: getValue(weatherData.hourly.apparent_temperature, index),
                dewPoint: getValue(weatherData.hourly.dew_point_2m, index),
                windSpeed: getValue(weatherData.hourly.wind_speed_10m, index),
                cloudCover: getValue(weatherData.hourly.cloud_cover, index),
                humidity: getValue(weatherData.hourly.relative_humidity_2m, index),
              }
            };
          });
          // Filter out entries where any crucial value is null or not a number (especially humidity for existing logic)
          setForecast(transformedForecast.filter(entry => 
            entry.values && 
            typeof entry.values.temperatureApparent === 'number' &&
            typeof entry.values.dewPoint === 'number' &&
            typeof entry.values.windSpeed === 'number' &&
            typeof entry.values.cloudCover === 'number' &&
            typeof entry.values.humidity === 'number'
          ));
        } else {
          setForecast([]); 
          console.warn("Open-Meteo response missing expected hourly data structure or data:", weatherData);
          // Do not throw error here, allow timezone fetch to proceed if weatherData is just empty
        }
        
        // Fetch timezone (existing logic)
        const timestamp = Math.floor(Date.now() / 1000);
        const tzUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${location.lat},${location.lon}&timestamp=${timestamp}&key=${Maps_API_KEY_FOR_TIMEZONE}`;
        const tzRes = await fetch(tzUrl);
        let errorDetail = `Timezone API request failed: ${tzRes.statusText} (status ${tzRes.status})`;
        if (!tzRes.ok) {
          try {
            const errorData = await tzRes.json();
            errorDetail += errorData.errorMessage ? ` - ${errorData.errorMessage}` : (errorData.status ? ` - Google API Status: ${errorData.status}` : '');
          } catch (e) { /* ignore parse error */ }
          throw new Error(errorDetail);
        }
        const tzData = await tzRes.json();
        if (tzData.status === 'OK' && tzData.timeZoneId) {
          setTimezoneId(tzData.timeZoneId);
        } else {
          // If forecast is also empty, this error is more critical
          const baseTzError = `Failed to fetch specific timezone (Google API Status: ${tzData.status || 'Unknown Error'})${tzData.errorMessage ? ' - ' + tzData.errorMessage : ''}.`;
          if (forecast.length === 0 && (!weatherData || !weatherData.hourly || !weatherData.hourly.time)) {
             throw new Error(`${baseTzError} Combined with weather data fetch issue.`);
          } else {
             console.warn(`${baseTzError} Using previous or default timezone.`);
             // Potentially set a default timezone or use the last known good one if critical
             // For now, it will just use the existing `timezoneId` state.
          }
        }
      } catch (e) {
        console.error('Error fetching forecast or timezone:', e);
        setError(e.message || 'Failed to fetch data. Please try again.');
        setForecast([]); // Clear forecast on error
      } finally {
        setIsLoading(false);
      }
    };
    fetchForecastAndZone();
  }, [location]); // Removed forecast from dependencies as it's set within this effect


  const handleLocationSelect = (loc) => {
    setLocation(loc);
    setSelectedActivities({});
  };


  const handleActivityChange = (dayString, activity) => {
    setSelectedActivities(prev => ({ ...prev, [dayString]: activity }));
  };


  const timeBuckets = [
    { label: 'Day Summary', hours: [], isSummary: true },
    { label: 'Early Morning\n(5am - 8am)', hours: [5, 6, 7] },
    { label: 'Morning\n(9am - 12pm)', hours: [9, 10, 11] }, 
    { label: 'Mid Day\n(12pm - 2pm)', hours: [12, 13, 14] }, 
    { label: 'Afternoon\n(3pm - 6pm)', hours: [15, 16, 17] },
    { label: 'Evening\n(7pm - 9pm)', hours: [19, 20, 21] },
    { label: 'Night\n(10pm - 12am)', hours: [22, 23] } 
  ];
  
  const groupedByDay = {};
  if (timezoneId && forecast.length > 0) {
   forecast.forEach((entry) => {
  if (!entry || !entry.time || !entry.values) return;

  let originalUtcDate;
  if (entry.time.endsWith('Z')) {
    originalUtcDate = new Date(entry.time); // already in UTC
  } else {
    originalUtcDate = new Date(entry.time + 'Z'); // append 'Z' to force UTC interpretation
  }

  if (isNaN(originalUtcDate.getTime())) return;


      if (isNaN(originalUtcDate.getTime())) return;
      
      let dayString;
      let localHour = null;
      let localDateStr = null;
      try {
        // Get the local date/time strings
        const localDateTime = originalUtcDate.toLocaleString('en-US', { 
          timeZone: timezoneId,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          hour12: false,
          weekday: 'short'
        });
        
        // Parse the localized date/time to extract components
        const localDate = new Date(originalUtcDate.toLocaleString('en-US', { timeZone: timezoneId }));
        
        dayString = originalUtcDate.toLocaleDateString('en-US', {
            weekday: 'short', month: 'numeric', day: 'numeric', timeZone: timezoneId,
        });
        
        // Get hour in 24-hour format
        const localTimeStr = originalUtcDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          hour12: false, 
          timeZone: timezoneId 
        });
        localHour = parseInt(localTimeStr.split(':')[0], 10);
        
        // Store a debug string to verify the conversion
        localDateStr = originalUtcDate.toLocaleString('en-US', { 
          timeZone: timezoneId,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
      } catch (e) {
        console.error("Error formatting date with timezone:", timezoneId, e);
        // Fallback to UTC date string if timezone is invalid, to prevent crash
        dayString = originalUtcDate.toLocaleDateString('en-US', {
            weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC'
        }) + " (UTC - TZ Error)";
        localHour = originalUtcDate.getUTCHours();
      }


      if (!groupedByDay[dayString]) groupedByDay[dayString] = [];
      
      groupedByDay[dayString].push({
        ...entry,
        originalUtcDate,
        localHour, // Store the calculated local hour with the entry
        localDateStr, // For debugging
      });
    });
    
    // Debug: Log first few entries to verify timezone conversion
    console.log('Timezone conversion debug:');
    Object.entries(groupedByDay).slice(0, 2).forEach(([day, entries]) => {
      console.log(`Day: ${day}`);
      entries.slice(0, 5).forEach(e => {
        console.log(`  UTC: ${e.time} -> Local: ${e.localDateStr} (Hour: ${e.localHour})`);
      });
    });
  }
  const orderedDays = Object.entries(groupedByDay).slice(0, 5);




  const renderContent = () => {
    if (isLoading) return <p>Loading forecast for <strong>{location.name || "selected location"}</strong>...</p>;
    if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
    if (!orderedDays.length && !isLoading) return <p>No forecast data available for <strong>{location.name || "selected location"}</strong>. This could be due to an issue fetching weather or timezone data. Please check console for details or try a different location.</p>;




    return (
      <div style={{ display: 'grid', gridAutoColumns: 'minmax(180px, 1fr)', gridTemplateColumns: `200px repeat(${Math.min(orderedDays.length, 5)}, 1fr)`, gap: '0.5rem 1rem', marginTop: '1rem', overflowX: 'auto' }}>
        {/* Header Row for Day Selection */}
        <div style={{ position: 'sticky', left: 0, background: 'white', zIndex: 10, height: '70px', borderBottom: '1px solid #ddd', borderRight: '1px solid #ddd', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold'}}>
            Time / Activity
        </div>
        {orderedDays.map(([dayString], idx) => (
          <div key={idx} style={{ fontWeight: 'bold', padding: '0.5rem', background: '#f0f0f0', textAlign: 'center', borderBottom: '1px solid #ddd', height: '70px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <div>{dayString}</div>
            <select
              value={selectedActivities[dayString] || 'general'}
              onChange={(e) => handleActivityChange(dayString, e.target.value)}
              style={{ marginTop: '0.25rem', padding: '0.25rem', fontSize: '0.8em', width: 'calc(100% - 10px)', maxWidth: '150px', boxSizing: 'border-box', borderRadius:'4px' }}
            >
              {activityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}


        {/* Data Rows for Time Buckets */}
        {timeBuckets.map((bucket, i) => (
          <React.Fragment key={bucket.label + i}> {/* Ensure unique key for fragment */}
            <div style={{ fontWeight: 'bold', whiteSpace: 'pre-wrap', padding: '0.5rem', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', left: 0, zIndex: 5, borderRight: '1px solid #ddd', borderBottom: i === timeBuckets.length -1 ? 'none' : '1px solid #ddd'}}>
              {bucket.label}
            </div>
            {orderedDays.map(([dayString, entriesForDay], j) => {
              // Unique key for each cell
              const cellKey = `${dayString}-${bucket.label}-${j}`; 


              if (!timezoneId && !bucket.isSummary) return <div key={cellKey} style={{ padding: '0.5rem', borderBottom: i === timeBuckets.length -1 ? 'none' : '1px solid #eee' }}>–</div>;


              if (bucket.isSummary) {
                const dayBucketData = timeBuckets.slice(1).map((tb) => { 
                  // FIXED: Use the stored localHour instead of recalculating
                  const entriesInBucket = entriesForDay.filter(e => {
                    return e && e.localHour !== null && !isNaN(e.localHour) && tb.hours.includes(e.localHour);
                  });


                  if (!entriesInBucket.length) return null;


                  let sumTemp = 0, sumDewPoint = 0, sumWind = 0, sumClouds = 0, sumHumidity = 0;
                  let actualEntriesCount = 0;
                  entriesInBucket.forEach(entry => {
                    if (entry.values &&
                        typeof entry.values.temperatureApparent === 'number' &&
                        typeof entry.values.dewPoint === 'number' &&
                        typeof entry.values.windSpeed === 'number' &&
                        typeof entry.values.cloudCover === 'number' &&
                        typeof entry.values.humidity === 'number') {
                      sumTemp += entry.values.temperatureApparent;
                      sumDewPoint += entry.values.dewPoint;
                      sumWind += entry.values.windSpeed;
                      sumClouds += entry.values.cloudCover;
                      sumHumidity += entry.values.humidity;
                      actualEntriesCount++;
                    }
                  });


                  if (actualEntriesCount === 0) return null;


                  return {
                    label: tb.label.split('\n')[0], 
                    avgValues: {
                      temp: sumTemp / actualEntriesCount,
                      dewPoint: sumDewPoint / actualEntriesCount,
                      wind: sumWind / actualEntriesCount,
                      clouds: sumClouds / actualEntriesCount,
                      humidity: sumHumidity / actualEntriesCount,
                      isSunny: (sumClouds / actualEntriesCount) < WEATHER_MODIFIERS.sunny.threshold, 
                    }
                  };
                }).filter(Boolean); 


                const currentActivity = selectedActivities[dayString] || 'general';
                const summaryText = dayBucketData.length > 0 ? getDaySummary(dayBucketData, currentActivity) : 'Insufficient data for day summary';
                
                return (
                  <div key={cellKey} style={{ textAlign: 'left', background: '#e8f4f8', padding: '0.5rem', borderRadius: '8px', border: '1px solid #d0e0e8', fontSize: '0.9em', borderBottom: i === timeBuckets.length -1 ? 'none' : '1px solid #eee' }}>
                    <p style={{ margin: '0', fontWeight: 'bold', color: '#2c5f7c' }}>{summaryText}</p>
                  </div>
                );
              }


              // Regular bucket handling
              // FIXED: Use the stored localHour instead of recalculating
              const entriesInBucket = entriesForDay.filter(e => {
                return e && e.localHour !== null && !isNaN(e.localHour) && bucket.hours.includes(e.localHour);
              });

              // Debug log for problematic buckets
              if (bucket.label.includes('Mid Day') || bucket.label.includes('Evening')) {
                console.log(`${dayString} - ${bucket.label}:`);
                console.log(`  Looking for hours: ${bucket.hours.join(', ')}`);
                console.log(`  Found ${entriesInBucket.length} entries`);
                entriesInBucket.slice(0, 3).forEach(e => {
                  console.log(`    ${e.localDateStr} (hour: ${e.localHour}) - Temp: ${e.values.temperatureApparent}°F`);
                });
              }


              if (!entriesInBucket.length) return <div key={cellKey} style={{ padding: '0.5rem', borderBottom: i === timeBuckets.length -1 ? 'none' : '1px solid #eee' }}>–</div>;
              
              let sumTemp = 0, sumDewPoint = 0, sumWind = 0, sumClouds = 0, sumHumidity = 0;
              let actualEntriesCount = 0;
              entriesInBucket.forEach(entry => {
                 if (entry.values &&
                        typeof entry.values.temperatureApparent === 'number' &&
                        typeof entry.values.dewPoint === 'number' &&
                        typeof entry.values.windSpeed === 'number' &&
                        typeof entry.values.cloudCover === 'number' &&
                        typeof entry.values.humidity === 'number') {
                      sumTemp += entry.values.temperatureApparent;
                      sumDewPoint += entry.values.dewPoint;
                      sumWind += entry.values.windSpeed;
                      sumClouds += entry.values.cloudCover;
                      sumHumidity += entry.values.humidity;
                      actualEntriesCount++;
                    }
              });


              if (actualEntriesCount === 0) return <div key={cellKey} style={{ padding: '0.5rem', borderBottom: i === timeBuckets.length -1 ? 'none' : '1px solid #eee' }}>Data N/A</div>;


              const avgValues = {
                temp: sumTemp / actualEntriesCount,
                dewPoint: sumDewPoint / actualEntriesCount,
                wind: sumWind / actualEntriesCount,
                clouds: sumClouds / actualEntriesCount,
                humidity: sumHumidity / actualEntriesCount,
                isSunny: (sumClouds / actualEntriesCount) < WEATHER_MODIFIERS.sunny.threshold, 
              };
              
              const currentActivity = selectedActivities[dayString] || 'general';
              const adviceText = getOutfitAdvice(avgValues, currentActivity);
              const explanationText = explainOutfitAdvice(avgValues, currentActivity);
              const timeStr = `Avg for ${bucket.label.split('\n')[0]}`;


              return (
                <div key={cellKey} style={{ textAlign: 'left', background: '#f9f9f9', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.9em', borderBottom: i === timeBuckets.length -1 ? 'none' : '1px solid #eee' }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 'bold' }}>{adviceText}</p>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.9em', color: '#555' }}>{explanationText}</p>
                  <small style={{ color: '#777', fontSize: '0.8em' }}>Based on: {timeStr}</small>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };


  return (
    <div style={{ maxWidth: '1200px', margin: '2rem auto', textAlign: 'center', padding: '0 1rem' }}>
      <h1>Wearcast</h1>
      <LocationSearch onSelect={handleLocationSelect} />
      {location.name && <p>Outfit suggestions for <strong>{location.name}</strong>:</p>}
      {renderContent()}
    </div>
  );
};


export default App;


