import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Send, MessageCircle, MapPin } from 'lucide-react';

// OpenRouter configuration
const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Your existing weather recommendation engine
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

// Weather recommender class
class WeatherRecommender {
  constructor() {
    this.profiles = ACTIVITY_PROFILES;
  }

  getRecommendation(weatherData, activity = 'general') {
    const profile = this.profiles[activity] || this.profiles.general;
    const effectiveTemp = weatherData.temp + (profile.tempAdjustment || 0);
    
    const comfort = this.assessComfort(effectiveTemp, weatherData, profile);
    
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
    
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    
    const timeBuckets = [
      { label: '9am-12pm', hours: [9, 10, 11] },
      { label: '12pm-3pm', hours: [12, 13, 14] },
      { label: '3pm-6pm', hours: [15, 16, 17] },
      { label: '6pm-9pm', hours: [18, 19, 20] }
    ];
    
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

// Styles
const styles = {
  container: {
    maxWidth: '430px',
    margin: '0 auto',
    backgroundColor: '#fff',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative'
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e5e5',
    padding: '16px 20px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    margin: '0 0 8px 0'
  },
  location: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#666',
    fontSize: '16px'
  },
  section: {
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e5e5e5'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px'
  },
  activityPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  activityPill: {
    padding: '10px 16px',
    borderRadius: '24px',
    fontSize: '15px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: '#e9ecef',
    color: '#333'
  },
  activityPillActive: {
    backgroundColor: '#007AFF',
    color: '#fff'
  },
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    margin: '0 20px 20px'
  },
  tempMain: {
    fontSize: '48px',
    fontWeight: '300',
    marginBottom: '4px'
  },
  feelsLike: {
    fontSize: '15px',
    color: '#666'
  },
  weatherIcon: {
    fontSize: '40px',
    marginBottom: '8px'
  },
  recommendationBox: {
    backgroundColor: '#e8f4ff',
    padding: '16px',
    borderRadius: '12px',
    marginTop: '16px'
  },
  recommendationTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: '8px'
  },
  recommendationText: {
    fontSize: '15px',
    color: '#333',
    lineHeight: '1.5'
  },
  comfortBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    marginTop: '8px'
  },
  timeSlot: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: '1px solid #e5e5e5'
  },
  timeLabel: {
    fontWeight: '600',
    marginBottom: '4px'
  },
  timeConditions: {
    fontSize: '14px',
    color: '#666'
  },
  comfortScore: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '18px',
    color: '#fff'
  },
  chatFab: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    backgroundColor: '#007AFF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,122,255,0.3)',
    cursor: 'pointer',
    border: 'none',
    color: '#fff'
  },
  chatOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '430px',
    margin: '0 auto'
  },
  chatHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e5e5e5',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#fff'
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    backgroundColor: '#f8f9fa'
  },
  message: {
    marginBottom: '16px',
    display: 'flex',
    gap: '10px'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '18px',
    fontSize: '15px',
    lineHeight: '1.4'
  },
  userBubble: {
    backgroundColor: '#007AFF',
    color: '#fff',
    marginLeft: 'auto'
  },
  assistantBubble: {
    backgroundColor: '#fff',
    color: '#333'
  },
  suggestionChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px'
  },
  suggestionChip: {
    padding: '8px 14px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '16px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  chatInputContainer: {
    padding: '16px 20px',
    borderTop: '1px solid #e5e5e5',
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  chatInput: {
    flex: 1,
    padding: '10px 16px',
    border: '1px solid #ddd',
    borderRadius: '20px',
    fontSize: '15px',
    outline: 'none'
  },
  sendButton: {
    width: '36px',
    height: '36px',
    backgroundColor: '#007AFF',
    border: 'none',
    borderRadius: '50%',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
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

  useEffect(() => {
    const loadWeather = async () => {
      const data = await fetchWeatherData();
      setWeatherData(data);
    };
    loadWeather();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleActivitySelect = (activity) => {
    setSelectedActivity(activity);
  };

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

  const getComfortColor = (score) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  const handleSendMessage = async (message = inputValue) => {
    if (!message.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInputValue('');
    setIsLoading(true);

    try {
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
      <div style={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div>Loading weather data...</div>
        </div>
      </div>
    );
  }

  const currentRecommendation = weatherRecommender.getRecommendation(weatherData.current, selectedActivity);
  const bestTimes = getBestTimes();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Wearcast</h1>
        <div style={styles.location}>
          <MapPin size={16} />
          <span>Los Angeles, CA</span>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>What are you planning?</h2>
        <div style={styles.activityPills}>
          {['general', 'running_sport', 'pool_lounging', 'eating_outside'].map(activity => (
            <button
              key={activity}
              onClick={() => handleActivitySelect(activity)}
              style={{
                ...styles.activityPill,
                ...(selectedActivity === activity ? styles.activityPillActive : {})
              }}
            >
              {activity === 'general' && 'General'}
              {activity === 'running_sport' && '🏃 Running'}
              {activity === 'pool_lounging' && '🏊 Pool'}
              {activity === 'eating_outside' && '🍽️ Dining'}
            </button>
          ))}
          <button
            onClick={() => setShowChat(true)}
            style={styles.activityPill}
          >
            ✈️ Travel
          </button>
        </div>
      </div>

      <div style={styles.weatherCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div style={styles.tempMain}>{weatherData.current.temp}°F</div>
            <div style={styles.feelsLike}>Feels like {weatherData.current.feels_like}°F</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={styles.weatherIcon}>{weatherData.current.icon}</div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {weatherData.current.description}
            </div>
          </div>
        </div>
        
        <div style={styles.recommendationBox}>
          <h3 style={styles.recommendationTitle}>Right now</h3>
          <p style={styles.recommendationText}>{currentRecommendation.clothing}</p>
          <div style={{ ...styles.comfortBadge, backgroundColor: getComfortColor(currentRecommendation.comfort) }}>
            {currentRecommendation.comfort}% comfort
          </div>
        </div>
      </div>

      <div style={styles.weatherCard}>
        <h3 style={styles.sectionTitle}>Best times today</h3>
        <div>
          {bestTimes.map((time, index) => (
            <div key={index} style={styles.timeSlot}>
              <div style={{ flex: 1 }}>
                <div style={styles.timeLabel}>{time.time}</div>
                <div style={styles.timeConditions}>
                  {time.temp}°F • {time.humidity}% humidity
                </div>
              </div>
              <div style={{ ...styles.comfortScore, backgroundColor: getComfortColor(time.comfort) }}>
                {time.comfort}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowChat(true)}
        style={styles.chatFab}
      >
        <MessageCircle size={24} />
      </button>

      {showChat && (
        <div style={styles.chatOverlay}>
          <div style={styles.chatHeader}>
            <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <ChevronLeft size={24} />
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Ask Wearcast</h2>
          </div>

          <div ref={chatContainerRef} style={styles.chatMessages}>
            {messages.map((message, index) => (
              <div key={index}>
                <div style={message.role === 'user' ? { ...styles.message, justifyContent: 'flex-end' } : styles.message}>
                  <div style={{
                    ...styles.messageBubble,
                    ...(message.role === 'user' ? styles.userBubble : styles.assistantBubble)
                  }}>
                    {message.content}
                  </div>
                </div>
                {message.suggestions && (
                  <div style={styles.suggestionChips}>
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(suggestion)}
                        style={styles.suggestionChip}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div style={{ color: '#666', fontSize: '14px' }}>Thinking...</div>
            )}
          </div>

          <div style={styles.chatInputContainer}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about weather or packing..."
              style={styles.chatInput}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              style={styles.sendButton}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;