const app = Vue.createApp({
    data() {
        return {
            weatherData: null,
            loading: false,
            error: null,
            openCageApiKey: '6eb6c06075c34a199bbcb67b29e33801',
            openCageApiUrl: 'https://api.opencagedata.com/geocode/v1/json',
            openWeatherApiKey: '52369564d2dc66c1fe013c20a839a624',
            openWeatherApiUrl: 'https://api.openweathermap.org/data/2.5/weather',
            cities: [],
            searchedCity: '',
            showWeeklyForecast: false,
        };
    },
    methods: { 
        async getCurrentLocationWeather() {
            this.loading = true;
            this.error = null;
        
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
                });
        
                const { latitude, longitude } = position.coords;
        
                // Use OpenCage Geocoding to get the location details
                const openCageResponse = await axios.get(
                    `${this.openCageApiUrl}?q=${latitude}+${longitude}&key=${this.openCageApiKey}`
                );
        
                console.log('OpenCage Geocoding Response:', openCageResponse.data);
        
                const locationDetails = openCageResponse.data.results[0];
        
                if (locationDetails && locationDetails.components) {
                    // Check if city is available in the response
                    const city = locationDetails.components.city || locationDetails.components.town;
        
                    if (city) {
                        // Fetch weather data using the obtained location details
                        const weatherResponse = await axios.get(
                            `${this.openWeatherApiUrl}?lat=${latitude}&lon=${longitude}&units=metric&appid=${this.openWeatherApiKey}`
                        );
        
                        // Update weather data with additional information
                        this.weatherData = {
                            name: city,
                            main: weatherResponse.data.main,
                            weather: weatherResponse.data.weather,
                            components: locationDetails.components, // Add components to weather data
                        };
                    } else {
                        this.error = 'City information not found in the geocoding response.';
                    }
                } else {
                    this.error = 'Invalid geocoding response format.';
                }
            } catch (error) {
                // Handle geolocation error
                console.error('Error fetching geolocation data:', error);
                this.error = 'Error fetching geolocation data.';
            } finally {
                this.loading = false;
            }        
        },                 
        async fetchWeatherData(city) {
            try {
                const response = await axios.get(this.buildWeatherApiUrl(city));
                // Assuming you want to store data for each city
                city.weatherData = response.data;
            } catch (error) {
                // Handle error
                console.error('Error fetching weather data:', error);
            } finally {
                // Set loading to false or perform other cleanup tasks
                this.loading = false;        
            }
        },               
        buildWeeklyWeatherApiUrl(city) {
            const { name, countryCode } = city;
            return `https://api.openweathermap.org/data/2.5/forecast?q=${name},${countryCode}&units=metric&appid=${this.openWeatherApiKey}`;        
        },
        buildWeatherApiUrl(city) {
            const { name, countryCode } = city;
            return `${this.openWeatherApiUrl}?q=${name},${countryCode}&units=metric&appid=${this.openWeatherApiKey}`;
        },
        groupForecastByDay(forecastList) {
            const groupedForecast = {};
        
            forecastList.forEach((forecast) => {
                const date = new Date(forecast.dt * 1000);
                const day = date.toISOString().split('T')[0];
        
                if (!groupedForecast[day]) {
                    groupedForecast[day] = [];
                }
        
                // Adjust the structure to include the necessary forecast information
                groupedForecast[day].push({
                    dt: forecast.dt,
                    main: forecast.main,
                    weather: forecast.weather,
                });
            });
        
            return groupedForecast;
        },  
        async fetchDailyForecast(city) {
            try {
                const response = await axios.get(this.buildDailyForecastApiUrl(city));
                this.dailyForecast = response.data;
            } catch (error) {
                console.error('Error fetching daily forecast data:', error);
                this.error = 'Error fetching daily forecast data.';
            } finally {
                this.loading = false;
            }
        },        
        async switchToDailyForecast() {
            try {
                this.loading = true;
                this.error = null;

                // Fetch daily forecast data for the current location
                await this.fetchDailyForecast({
                    name: this.weatherData.name,
                    countryCode: this.weatherData.components.country_code,
                });

                this.showWeeklyForecast = false;
            } catch (error) {
                console.error('Error switching to daily forecast:', error);
                this.error = 'Error switching to daily forecast.';
            }
        },
   
          // Updated method to fetch 5-day forecast for the current location
          async switchToWeeklyForecast() {
            try {
                this.loading = true;
                this.error = null;

                // Fetch weekly forecast data for the current location
                await this.fetchWeeklyForecast({
                    name: this.weatherData.name,
                    countryCode: this.weatherData.components.country_code,
                });

                this.showWeeklyForecast = true;
            } catch (error) {
                console.error('Error switching to weekly forecast:', error);
                this.error = 'Error switching to weekly forecast.';
            }
        }, 
        buildDailyForecastApiUrl(city) {
            const { name, countryCode } = city;
            return `https://api.openweathermap.org/data/2.5/forecast?q=${name},${countryCode}&units=metric&appid=${this.openWeatherApiKey}`;
        },
        async fetchWeeklyForecast(city) {
            try {
                const response = await axios.get(this.buildWeeklyWeatherApiUrl(city));
                console.log('Weekly Forecast API Response:', response.data);
        
                // Check if this.weatherData has the weeklyWeatherData property
                if (!this.weatherData.weeklyWeatherData) {
                    this.weatherData.weeklyWeatherData = {};
                }
        
                // Assuming you want to store data for each city
                const processedData = this.groupForecastByDay(response.data.list);
                this.weatherData.weeklyWeatherData = { [city.name]: processedData };
                console.log('Processed Weekly Weather Data:', this.weatherData.weeklyWeatherData);
            } catch (error) {
                console.error('Error fetching weekly forecast data:', error);
                this.error = 'Error fetching weekly forecast data.';
            } finally {
                this.loading = false;
            }
        },
        async searchWeather(event) {
            // Check if the pressed key is Enter (key code 13)
            if (event.keyCode === 13) {
                event.preventDefault();
        
                if (!this.searchedCity) {
                    return;
                }
        
                this.loading = true;
                this.error = null;
        
                try {
                    const response = await axios.get(this.buildWeatherApiUrl({
                        name: this.searchedCity,
                        countryCode: '',  // Provide a country code if needed
                    }));
        
                    this.weatherData = response.data;
                } catch (error) {
                    this.error = 'Error fetching weather data.';
                } finally {
                    this.loading = false;
                }
            }
        },
        getCurrentTime() {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');

            return `${hours}:${minutes}`;
        }, 
        getFullLocation() {
            if (!this.weatherData) {
                console.error('No weather data available.');
                return '';
            }
        
            const { components } = this.weatherData;
        
            if (!components) {
                console.error('No components property in weatherData.');
                return '';
            }
        
            // Extract components for more detailed location information
            const city = components.city || components.town || '';
            const region = components.state || components.province || '';
            const country = components.country || '';
            const county = components.county || '';
            const suburb = components.suburb || '';
        
            // Build the full location string
            const fullLocation = `${city}, ${region}, ${country}`.trim().replace(/,+/g, ',');
        
            console.log('Full location:', fullLocation);
        
            return fullLocation;
        }   
    },
    async mounted() {
        try {
            // Automatically fetch weather for the user's current location
            await this.getCurrentLocationWeather();
    
            // Fetch the list of cities from OpenWeatherMap without using geolocation
            const citiesResponse = await axios.get(
                `https://api.openweathermap.org/data/2.5/find?lat=0&lon=0&cnt=10&appid=${this.openWeatherApiKey}`
            );
    
            // Update the cities array with the list of cities from the API response
            this.cities = citiesResponse.data.list;
    
            // Fetch weather data for each city
            for (const city of this.cities) {
                await this.fetchWeatherData(city);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            this.error = 'Error fetching data.';
            this.loading = false;
        }
    },    
});



