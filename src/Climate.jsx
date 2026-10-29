import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Droplets,
  Wind,
  Gauge,
  Eye,
  Sunrise,
  Sunset,
} from "lucide-react";

import './Climate.css';

import searchIcon from './assets/search.png';
import clearIcon from './assets/clear.png';
import cloudIcon from './assets/cloud.png';
import drizzleIcon from './assets/drizzle.png';
import rainIcon from './assets/rain.png';
import snowIcon from './assets/snow.png';

const WEATHER_ICONS = {
  '01d': clearIcon,
  '01n': clearIcon,
  '02d': cloudIcon,
  '02n': cloudIcon,
  '03d': cloudIcon,
  '03n': cloudIcon,
  '04d': drizzleIcon,
  '04n': drizzleIcon,
  '09d': rainIcon,
  '09n': rainIcon,
  '10d': rainIcon,
  '10n': rainIcon,
  '11d': rainIcon,
  '11n': rainIcon,
  '13d': snowIcon,
  '13n': snowIcon,
  '50d': cloudIcon,
  '50n': cloudIcon,
};

function formatDate() {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

function getWeatherTheme(condition, iconCode, windSpeedMs = 0) {
  const weather = condition?.toLowerCase() || '';

  if (weather.includes('thunderstorm')) return 'stormy';

  if (weather.includes('drizzle') || weather.includes('rain')) {
    return 'rainy';
  }

  if (weather.includes('snow')) return 'snowy';

  if (
    weather.includes('mist') ||
    weather.includes('fog') ||
    weather.includes('haze') ||
    weather.includes('smoke') ||
    weather.includes('dust') ||
    weather.includes('sand') ||
    weather.includes('ash') ||
    weather.includes('squall') ||
    weather.includes('tornado')
  ) {
    return 'misty';
  }

  if (windSpeedMs >= 10) return 'windy';

  if (weather.includes('cloud')) {
    return iconCode?.endsWith('n') ? 'cloudy-night' : 'cloudy';
  }

  if (weather.includes('clear')) {
    return iconCode?.endsWith('n') ? 'clear-night' : 'sunny';
  }

  return 'cloudy';
}

function formatLocalTime(unixTime, timezoneOffset) {
  const date = new Date((unixTime + timezoneOffset) * 1000);

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}


function getForecastLocalDate(timestamp, timezoneOffset = 0) {
  return new Date(
    (timestamp + timezoneOffset) * 1000
  ).toISOString().slice(0, 10);
}

function getForecastLocalHour(timestamp, timezoneOffset = 0) {
  const date = new Date(
    (timestamp + timezoneOffset) * 1000
  );

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  });
}

function Climate() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forecast, setForecast] = useState([]);

  const requestId = useRef(0);

  const hourlyForecast = forecast.slice(0, 8);

  const dailyForecast = Object.values(
    forecast.reduce((days, item) => {
      const date = getForecastLocalDate(
        item.dt,
        weather?.timezone || 0
      );

      if (!days[date]) {
        days[date] = {
          date,
          items: [],
        };
      }

      days[date].items.push(item);
      return days;
    }, {})
  ).slice(0, 5).map((day) => {
    const temps = day.items.map((item) => item.main.temp);
    const middayItem =
      day.items.find((item) => {
        const hour = new Date(
          (item.dt + (weather?.timezone || 0)) * 1000
        ).getUTCHours();

        return hour >= 11 && hour <= 14;
      }) || day.items[Math.floor(day.items.length / 2)];

    return {
      ...day,
      weather: middayItem.weather[0],
      min: Math.round(Math.min(...temps)),
      max: Math.round(Math.max(...temps)),
    };
  });


  const searchWeather = useCallback(async (event, cityName) => {
    event?.preventDefault();

    const trimmedCity = cityName.trim();

    if (!trimmedCity) {
      setError('Please enter a city name to check the weather.');
      return;
    }

    const apiKey = import.meta.env.VITE_APP_ID;

    if (!apiKey) {
      setError('API key is missing. Please check your .env file.');
      return;
    }

    const currentRequest = ++requestId.current;

    setLoading(true);
    setError('');

    try {
      const url = new URL(
        'https://api.openweathermap.org/data/2.5/weather'
      );

      url.search = new URLSearchParams({
        q: trimmedCity,
        units: 'metric',
        appid: apiKey,
      }).toString();

      const response = await fetch(url);
      const data = await response.json();

      // Ignore results from older searches.
      if (currentRequest !== requestId.current) return;

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            'City not found. Check the spelling and try again.'
          );
        }

        if (response.status === 401) {
          throw new Error(
            'API key is invalid or not active yet. Please check your key.'
          );
        }

        if (response.status === 429) {
          throw new Error(
            'API request limit reached. Please try again later.'
          );
        }

        throw new Error(
          data.message || 'Unable to fetch weather information.'
        );
      }

      setWeather({
        city: data.name,
        country: data.sys.country,
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        description: data.weather[0].description,
        icon: WEATHER_ICONS[data.weather[0].icon] || clearIcon,
        humidity: data.main.humidity,
        windSpeed: (data.wind.speed * 3.6).toFixed(1),
        minTemp: Math.round(data.main.temp_min),
        maxTemp: Math.round(data.main.temp_max),
        pressure: data.main.pressure,
        visibility: (data.visibility / 1000).toFixed(1),
        sunrise: data.sys.sunrise,
        sunset: data.sys.sunset,
        timezone: data.timezone,
        theme: getWeatherTheme(
          data.weather[0].main,
          data.weather[0].icon,
          data.wind.speed
        ),
      });

      setCity(data.name);
      
      try {
        const forecastUrl = new URL(
          'https://api.openweathermap.org/data/2.5/forecast'
        );

        forecastUrl.search = new URLSearchParams({
          q: data.name,
          units: 'metric',
          appid: apiKey,
        }).toString();

        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();

        if (currentRequest !== requestId.current) return;

        if (!forecastResponse.ok) {
          throw new Error(
            forecastData.message || 'Forecast unavailable'
          );
        }

        setForecast(forecastData.list || []);
      } catch (forecastErr) {
        if (currentRequest !== requestId.current) return;

        console.error('Forecast request failed:', forecastErr);
        setForecast([]);
      }
    } catch (err) {
      if (currentRequest !== requestId.current) return;

      setError(
        err instanceof TypeError
          ? 'Network error. Check your internet connection.'
          : err.message || 'Something went wrong. Please try again.'
      );
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    searchWeather(null, 'Hyderabad');

    return () => {
      // Invalidate any outstanding request on cleanup.
      requestId.current += 1;
    };
  }, [searchWeather]);

  const handleSearch = (event) => {
    searchWeather(event, city);
  };

  return (
    <main className={`weather-page theme-${weather?.theme || 'sunny'}`}>
      <div className="weather-glow weather-glow-one" />
      <div className="weather-glow weather-glow-two" />

      <header className="app-header">
        <a className="brand" href="/" aria-label="WeatherNow home">
          <img
            className="brand-logo"
            src="/weather-logo.png"
            alt="WeatherNow logo"
          />

          <span>
            Weather<span className="brand-accent">Now</span>
          </span>
        </a>

        <span className="header-label">
          <span className="status-dot" />
          LIVE WEATHER
        </span>
      </header>

      <section className="weather-dashboard">
        <div className="dashboard-heading">
          <p className="eyebrow">YOUR WEATHER, AT A GLANCE</p>
          <h1>Weather dashboard</h1>
          <p className="dashboard-subtitle">
            Discover the weather conditions in your city.
          </p>
        </div>

        <form className="search-bar" onSubmit={handleSearch}>
          <img src={searchIcon} alt="" />

          <input
            type="search"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Search for a city..."
            aria-label="Search for a city"
            autoComplete="off"
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="error-message" role="alert">
            <span aria-hidden="true">!</span>
            <p>{error}</p>
          </div>
        )}

        {loading && !weather && (
          <div className="loading-panel" role="status">
            <span className="loading-spinner" />
            <p>Getting the latest weather...</p>
          </div>
        )}

        {weather && (
          <>
            <article
              className={`current-weather ${
                loading ? 'is-refreshing' : ''
              }`}
              aria-busy={loading}
            >
              <div className="weather-main">
                <div className="weather-location">
                  <span className="location-pin" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      width="19"
                      height="19"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </span>

                  <div>
                    <h2>
                      {weather.city}, {weather.country}
                    </h2>
                    <p>{formatDate()}</p>
                  </div>
                </div>

                <div className="temperature-block">
                  <div>
                    <p className="temperature">
                      {weather.temperature}
                      <span>°C</span>
                    </p>

                    <p className="weather-description">
                      {weather.description}
                    </p>
                  </div>

                  <img
                    className="weather-icon"
                    src={weather.icon}
                    alt={weather.description}
                  />
                </div>

                <div className="temperature-range">
                  <span>
                    <span aria-hidden="true">↑</span> {weather.maxTemp}°
                    <span className="range-label"> High</span>
                  </span>

                  <span>
                    <span aria-hidden="true">↓</span> {weather.minTemp}°
                    <span className="range-label"> Low</span>
                  </span>

                  <span>Feels like {weather.feelsLike}°C</span>
                </div>
              </div>

              <div className="weather-side-note">
                <span className="side-note-label">
                  CURRENT CONDITIONS
                </span>

                <p>Weather updates for your day.</p>

                <span className="side-note-indicator">
                  <span className="status-dot" />
                  {loading ? 'Updating weather' : 'Latest result loaded'}
                </span>
              </div>
            </article>

            <section className="forecast-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">NEXT 24 HOURS</p>
                  <h2>Hourly forecast</h2>
                </div>
                <span className="units-label">3-HOUR INTERVALS</span>
              </div>

              <div className="hourly-forecast">
                {hourlyForecast.map((item) => (
                  <article className="hourly-card" key={item.dt}>
                    <p className="forecast-time">
                      {getForecastLocalHour(item.dt, weather.timezone)}
                    </p>

                    <img
                      className="forecast-icon"
                      src={
                        WEATHER_ICONS[item.weather[0].icon] || clearIcon
                      }
                      alt={item.weather[0].description}
                    />

                    <p className="forecast-temperature">
                      {Math.round(item.main.temp)}°C
                    </p>

                    <p className="forecast-description">
                      {item.weather[0].description}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="forecast-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">PLAN AHEAD</p>
                  <h2>5-day forecast</h2>
                </div>
                <span className="units-label">DAILY OUTLOOK</span>
              </div>

              <div className="daily-forecast">
                {dailyForecast.map((day, index) => (
                  <article className="daily-card" key={day.date}>
                    <div className="daily-date">
                      <strong>
                        {index === 0
                          ? 'Today'
                          : new Date(`${day.date}T12:00:00Z`).toLocaleDateString(
                              'en-US',
                              { weekday: 'short', timeZone: 'UTC' }
                            )}
                      </strong>
                      <span>
                        {new Date(`${day.date}T12:00:00Z`).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric', timeZone: 'UTC' }
                        )}
                      </span>
                    </div>

                    <img
                      className="daily-weather-icon"
                      src={WEATHER_ICONS[day.weather.icon] || clearIcon}
                      alt={day.weather.description}
                    />

                    <p className="daily-description">
                      {day.weather.description}
                    </p>

                    <div className="daily-temperatures">
                      <strong>{day.max}°</strong>
                      <span>{day.min}°</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            
            <section className="details-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">WEATHER BREAKDOWN</p>
                  <h2>Today's conditions</h2>
                </div>

                <span className="units-label">METRIC UNITS</span>
              </div>

              <div className="details-grid">
                <article className="detail-card">
                  <div className="detail-card-heading">
                    <span>Humidity</span>

                    <div className="detail-card-icon humidity-icon">
                      <Droplets size={38} strokeWidth={1.7} />
                    </div>
                  </div>

                  <p className="detail-value">
                    {weather.humidity}
                    <span> %</span>
                  </p>

                  <p className="detail-caption">
                    Moisture in the air
                  </p>

                  <div className="detail-progress">
                    <span
                      style={{ width: `${weather.humidity}%` }}
                    />
                  </div>
                </article>

                <article className="detail-card">
                  <div className="detail-card-heading">
                    <span>Wind speed</span>

                    <div className="detail-card-icon wind-icon">
                      <Wind size={30} strokeWidth={1.7} />
                    </div>
                  </div>

                  <p className="detail-value">
                    {weather.windSpeed}
                    <span> km/h</span>
                  </p>

                  <p className="detail-caption">
                    Air movement
                  </p>

                  <div className="detail-progress">
                    <span
                      style={{
                        width: `${Math.min(
                          (Number(weather.windSpeed) / 60) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </article>

                <article className="detail-card">
                  <div className="detail-card-heading">
                    <span>Pressure</span>
                  </div>

                  <div className="detail-card-icon pressure-icon">
                    <Gauge size={30} strokeWidth={1.7} />
                  </div>

                  <p className="detail-value">
                    {weather.pressure}
                    <span> hPa</span>
                  </p>

                  <p className="detail-caption">
                    Atmospheric pressure
                  </p>
                </article>

                <article className="detail-card">
                  <div className="detail-card-heading">
                    <span>Visibility</span>
                  </div>

                  <div className="detail-card-icon visibility-icon">
                    <Eye size={30} strokeWidth={1.7} />
                  </div>

                  <p className="detail-value">
                    {weather.visibility}
                    <span> km</span>
                  </p>

                  <p className="detail-caption">
                    Viewing distance
                  </p>
                </article>

                <article className="detail-card">
                  <div className="detail-card-heading">
                    <span>Sunrise</span>
                  </div>

                  <div className="detail-card-icon sunrise-icon">
                    <Sunrise size={30} strokeWidth={1.7} />
                  </div>

                  <p className="detail-value">
                    {formatLocalTime(
                      weather.sunrise,
                      weather.timezone
                    )}
                  </p>

                  <p className="detail-caption">
                    Local sunrise time
                  </p>
                </article>

                <article className="detail-card">
                  <div className="detail-card-heading">
                    <span>Sunset</span>
                  </div>

                  <div className="detail-card-icon sunset-icon">
                    <Sunset size={30} strokeWidth={1.7} />
                  </div>

                  <p className="detail-value">
                    {formatLocalTime(
                      weather.sunset,
                      weather.timezone
                    )}
                  </p>

                  <p className="detail-caption">
                    Local sunset time
                  </p>
                </article>
              </div>
            </section>
          </>
        )}

        <footer className="dashboard-footer">
          <span>WeatherNow</span>
          <span>Weather data by OpenWeatherMap</span>
        </footer>
      </section>
    </main>
  );
}

export default Climate;