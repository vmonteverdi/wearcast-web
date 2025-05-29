import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Send, MessageCircle, X, MapPin, Calendar, Cloud, Wind, Droplets, Sun, CloudRain, Loader } from 'lucide-react';

// OpenRouter configuration
const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Your existing weather recommendation engine (keeping all the logic)
const ACTIVITY_PROFILES = {
  general: {
    name: 'General',
    tempRange: { ideal: [65, 75], comfortable: [55, 82], tolerable: [45, 88] },
    windSensitivity: 1.0,
    humiditySensitivity: 1.0,
    sunRequirement: 'neutral',
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
    humiditySensitivity: 1.5,
    sunRequirement: 'low',
    wetnessTolerance: 'high',
    tempAdjustment: -7,
  },
  eating_outside: {
    name: 'Eating Outside',
    tempRange: { ideal: [68, 78], comfortable: [62, 82], tolerable: [55, 88] },
    windSensitivity: 1.5,
    humiditySensitivity: 1.1,
    sunRequirement: 'neutral',
    wetnessTolerance: 'very_low',
  },
  pool_lounging: {
    name: 'Lounging by Pool',
    tempRange: { ideal: [78, 88], comfortable: [73, 92], tolerable: [68, 95] },
    windSensitivity: 1.3,
    humiditySensitivity: 0.7,
    sunRequirement: 'high',
    wetnessTolerance: 'high',
  },
};

// Simplified weather recommender class
class WeatherRecommender {
  constructor() {
    this.profiles = ACTIVITY_PROFILES;
  }

  getRecommendation(weatherData, activity = 'general') {
    const profile = this.profiles[activity] || this.profiles.general;
    const effectiveTemp = weatherData.temp + (profile.tempAdjustment || 0);
    
    // Calculate comfort score
    const comfort = this.assessComfort(effectiveTemp, weatherData, profile);
    
    // Get clothing recommendation
    let clothing = '';
    if (effectiveTemp < 45) clothing = "Bundle up: heavy winter coat, hat, and gloves";
    else if (effectiveTemp < 55) clothing = "Wear a heavy jacket or coat";
    else if (effectiveTemp < 62) clothing = "A medium jacket is needed";
    else if (effectiveTemp < 68) clothing = "Light jacket or long sleeves";
    else if (effectiveTemp < 75) clothing = "Short sleeves are perfect";
    else if (effectiveTemp < 82) clothing = "Light clothing recommended";
    else if (effectiveTemp < 88) clothing = "Dress light and stay cool";
    else clothing = "Minimal clothing, stay hydrated";
    
    return { clothing, comfort };
  }

  assessComfort(temp, weather, profile) {
    const { ideal, comfortable, tolerable } = profile.tempRange;
    let score = 0;
    
    if (temp >= ideal[0] && temp <= ideal[1]) score = 100;
    else if (temp >= comfortable[0] && temp <= comfortable[1]) score = 75;
    else if (temp >= tolerable[0] && temp <= tolerable[1]) score = 50;
    else score = 25;
    
    if (weather.wind > 15) score -= 10 * profile.windSensitivity;
    if (weather.humidity > 70) score -= 10 * profile.humiditySensitivity;
    if (profile.sunRequirement === 'high' && weather.clouds > 50) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }
}

const weatherRecommender = new WeatherRecommender();

// Fetch weather data from Open-Meteo API
const fetchWeatherData = async (lat = 34.0522, lon = -118.2437) => {
  const weatherParams = [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "dew_point_2m",
    "wind_speed_10m",
    "cloud_cover",
    "weather_code",
    "is_day"
  ].join(',');
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${weatherParams}&hourly=${weatherParams}&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data || !data.current || !data.hourly) {
      throw new Error('Invalid weather data received');
    }
    
    // Get weather description from weather code
    const getWeatherDescription = (code, isDay) => {
      if (code === 0) return isDay ? 'Sunny' : 'Clear';
      if (code <= 3) return 'Partly Cloudy';
      if (code <= 48) return 'Foggy';
      if (code <= 57) return 'Drizzle';
      if (code <= 65) return 'Rainy';
      if (code <= 77) return 'Snowy';
      if (code <= 82) return 'Showers';
      if (code <= 99) return 'Thunderstorm';
      return 'Unknown';
    };
    
    // Process current weather
    const current = {
      temp: Math.round(data.current.temperature_2m),
      feels_like: Math.round(data.current.apparent_temperature),
      humidity: data.current.relative_humidity_2m,
      dewPoint: data.current.dew_point_2m,
      wind: Math.round(data.current.wind_speed_10m),
      clouds: data.current.cloud_cover,
      description: getWeatherDescription(data.current.weather_code, data.current.is_day),
      icon: data.current.cloud_cover < 30 && data.current.is_day ? '☀️' : 
            data.current.cloud_cover > 70 ? '☁️' : '⛅'
    };
    
    // Process hourly data for today
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    
    // Define time buckets
    const timeBuckets = [
      { label: '9am-12pm', hours: [9, 10, 11] },
      { label: '12pm-3pm', hours: [12, 13, 14] },
      { label: '3pm-6pm', hours: [15, 16, 17] },
      { label: '6pm-9pm', hours: [18, 19, 20] }
    ];
    
    // Process hourly data into time buckets
    const hourly = timeBuckets.map(bucket => {
      const bucketData = bucket.hours.map(hour => {
        const index = data.hourly.time.findIndex(t => 
          t.startsWith(todayDate) && new Date(t).getHours() === hour
        );
        
        if (index === -1) return null;
        
        return {
          temp: data.hourly.temperature_2m[index],
          humidity: data.hourly.relative_humidity_2m[index],
          wind: data.hourly.wind_speed_10m[index],
          clouds: data.hourly.cloud_cover[index]
        };
      }).filter(Boolean);
      
      if (bucketData.length === 0) return null;
      
      // Average the values for the time bucket
      const avg = bucketData.reduce((acc, curr) => ({
        temp: acc.temp + curr.temp,
        humidity: acc.humidity + curr.humidity,
        wind: acc.wind + curr.wind,
        clouds: acc.clouds + curr.clouds
      }), { temp: 0, humidity: 0, wind: 0, clouds: 0 });
      
      const count = bucketData.length;
      return {
        time: bucket.label,
        temp: Math.round(avg.temp / count),
        humidity: Math.round(avg.humidity / count),
        wind: Math.round(avg.wind / count),
        clouds: Math.round(avg.clouds / count)
      };
    }).filter(Boolean);
    
    // Process 7-day forecast
    const forecast = [];
    const days = [...new Set(data.hourly.time.map(t => t.split('T')[0]))];
    
    days.slice(0, 7).forEach(day => {
      const dayIndices = data.hourly.time
        .map((t, i) => t.startsWith(day) ? i : -1)
        .filter(i => i !== -1);
      
      if (dayIndices.length === 0) return;
      
      const dayData = dayIndices.map(i => ({
        temp: data.hourly.temperature_2m[i],
        humidity: data.hourly.relative_humidity_2m[i],
        wind: data.hourly.wind_speed_10m[i],
        clouds: data.hourly.cloud_cover[i]
      }));
      
      forecast.push({
        date: day,
        high: Math.round(Math.max(...dayData.map(d => d.temp))),
        low: Math.round(Math.min(...dayData.map(d => d.temp))),
        avgHumidity: Math.round(dayData.reduce((sum, d) => sum + d.humidity, 0) / dayData.length),
        avgWind: Math.round(dayData.reduce((sum, d) => sum + d.wind, 0) / dayData.length),
        avgClouds: Math.round(dayData.reduce((sum, d) => sum + d.clouds, 0) / dayData.length)
      });
    });
    
    return { current, hourly, forecast };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    // Return fallback data if API fails
    return {
      current: {
        temp: 72,
        feels_like: 68,
        humidity: 65,
        wind: 8,
        clouds: 20,
        description: 'Sunny',
        icon: '☀️'
      },
      hourly: [
        { time: '9am-12pm', temp: 68, humidity: 60, wind: 5, clouds: 10 },
        { time: '12pm-3pm', temp: 75, humidity: 55, wind: 10, clouds: 15 },
        { time: '3pm-6pm', temp: 78, humidity: 50, wind: 12, clouds: 20 },
        { time: '6pm-9pm', temp: 65, humidity: 65, wind: 8, clouds: 25 },
      ],
      forecast: []
    };
  }
};

// Get weather icon based on conditions
const getWeatherIcon = (clouds, isRaining) => {
  if (isRaining) return <CloudRain className="w-10 h-10 text-blue-500" />;
  if (clouds > 70) return <Cloud className="w-10 h-10 text-gray-500" />;
  if (clouds > 30) return <Cloud className="w-10 h-10 text-gray-400" />;
  return <Sun className="w-10 h-10 text-yellow-500" />;
};

// Main App Component
const App = () => {
  const [selectedActivity, setSelectedActivity] = useState('general');
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey! I can help you plan what to wear or pack. What would you like to know?",
      suggestions: [
        "What to pack for Tokyo?",
        "Good day for a hike?",
        "Beach weather this weekend?"
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const chatContainerRef = useRef(null);

  // Load weather data on mount
  useEffect(() => {
    const loadWeather = async () => {
      const data = await fetchWeatherData();
      setWeatherData(data);
    };
    loadWeather();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle activity selection
  const handleActivitySelect = (activity) => {
    setSelectedActivity(activity);
  };

  // Get best times for selected activity
  const getBestTimes = () => {
    if (!weatherData) return [];
    
    return weatherData.hourly.map(hour => {
      const recommendation = weatherRecommender.getRecommendation(hour, selectedActivity);
      return {
        ...hour,
        ...recommendation
      };
    }).sort((a, b) => b.comfort - a.comfort).slice(0, 3);
  };

  // Get comfort color
  const getComfortColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Handle chat message send
  const handleSendMessage = async (message = inputValue) => {
    if (!message.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Create context with weather data for the LLM
      const context = `
        You are Wearcast, a friendly weather assistant. Use the following current weather data to provide personalized advice:
        
        Current location: Los Angeles, CA
        Current conditions: ${weatherData.current.temp}°F (feels like ${weatherData.current.feels_like}°F), ${weatherData.current.description}, ${weatherData.current.humidity}% humidity, ${weatherData.current.wind}mph wind
        
        Today's forecast by time:
        ${weatherData.hourly.map(h => `${h.time}: ${h.temp}°F, ${h.humidity}% humidity, ${h.wind}mph wind`).join('\n')}
        
        7-day forecast:
        ${weatherData.forecast.slice(0, 7).map(d => `${d.date}: High ${d.high}°F, Low ${d.low}°F, ${d.avgHumidity}% humidity, ${d.avgWind}mph wind`).join('\n')}
        
        Provide specific, actionable advice about what to wear or pack. Be concise and friendly.
        For travel queries, look up the destination's weather and provide a detailed packing list.
        Always consider the activity type when giving recommendations.
      `;

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Wearcast'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [
            { role: 'system', content: context },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.choices[0].message.content
        }]);
      }
    } catch (error) {
      console.error('Error calling OpenRouter:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again later."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!weatherData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const currentRecommendation = weatherRecommender.getRecommendation(weatherData.current, selectedActivity);
  const bestTimes = getBestTimes();

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-3xl font-bold">Wearcast</h1>
        <div className="flex items-center gap-2 text-gray-600 mt-1">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">Los Angeles, CA</span>
        </div>
      </div>

      {/* Activity Selection */}
      <div className="px-5 py-4 bg-white border-b border-gray-100">
        <h2 className="text-lg font-semibold mb-3">What are you planning?</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleActivitySelect('general')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedActivity === 'general' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            General
          </button>
          <button
            onClick={() => handleActivitySelect('running_sport')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedActivity === 'running_sport' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🏃 Running
          </button>
          <button
            onClick={() => handleActivitySelect('pool_lounging')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedActivity === 'pool_lounging' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🏊 Pool
          </button>
          <button
            onClick={() => handleActivitySelect('eating_outside')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedActivity === 'eating_outside' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🍽️ Dining
          </button>
          <button
            onClick={() => setShowChat(true)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            ✈️ Travel
          </button>
        </div>
      </div>

      {/* Current Weather */}
      <div className="px-5 py-4 bg-gray-50">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-5xl font-light">{weatherData.current.temp}°F</div>
              <div className="text-sm text-gray-500 mt-1">Feels like {weatherData.current.feels_like}°F</div>
            </div>
            <div className="text-right">
              {getWeatherIcon(weatherData.current.clouds, false)}
              <div className="text-sm text-gray-600 mt-2">
                {weatherData.current.description}
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-xl p-4 mt-4">
            <h3 className="font-semibold text-blue-900 mb-2">Right now</h3>
            <p className="text-sm text-blue-800">{currentRecommendation.clothing}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className={`text-xs font-semibold text-white px-2 py-1 rounded-full ${getComfortColor(currentRecommendation.comfort)}`}>
                {currentRecommendation.comfort}% comfort
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Best Times */}
      <div className="px-5 py-4 bg-gray-50">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Best times today</h3>
          <div className="space-y-3">
            {bestTimes.map((time, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <div className="font-medium">{time.time}</div>
                  <div className="text-sm text-gray-600">
                    {time.temp}°F • {time.humidity}% humidity
                  </div>
                </div>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold ${getComfortColor(time.comfort)}`}>
                  {time.comfort}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat FAB */}
      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-blue-600 transition-colors"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Overlay */}
      {showChat && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-200">
            <button onClick={() => setShowChat(false)}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold">Ask Wearcast</h2>
          </div>

          {/* Messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50">
            {messages.map((message, index) => (
              <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block max-w-[80%] ${message.role === 'user' ? 'ml-auto' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-800'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.suggestions && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {message.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(suggestion)}
                          className="text-sm px-3 py-2 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-5 py-4 bg-white border-t border-gray-200">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about weather or packing..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
