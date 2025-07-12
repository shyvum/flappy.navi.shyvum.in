/**
 * API Service for Flappy Bird Game
 * Fetches game parameters from backend API
 */

class GameAPIService {
    constructor() {
        this.baseURL = 'https://arcadex-platform.loca.lt/user-engagement-platform';
        this.customerId = 'shivam'; // Fixed customer ID as per your example
        this.gameInstanceId = null; // Will be set from FLAPPY_BIRD template
        this.gameParameters = null; // Will be set from API only
        this.isOnline = false;
        this.isInitialized = false;
        this.onInitializedCallback = null;
        
        // Initialize and sync with backend
        this.init();
    }

    /**
     * Initialize API service and sync with backend
     */
    async init() {
        try {
            await this.syncGameParameters();
            this.isInitialized = true;
            
            // Call callback if set
            if (this.onInitializedCallback) {
                this.onInitializedCallback();
            }
        } catch (error) {
            this.isOnline = false;
            this.isInitialized = false;
        }
    }

    /**
     * Sync game parameters from backend API
     * GET /api/games/sync/{customerId}
     */
    async syncGameParameters() {
        try {
            const response = await fetch(`${this.baseURL}/api/games/sync/${this.customerId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors' // Enable CORS
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Find the FLAPPY_BIRD game template
            let flappyBirdGame = null;
            if (data.games && data.games.length > 0) {
                flappyBirdGame = data.games.find(game => 
                    game.gameTemplateName === 'FLAPPY_BIRD'
                );
            }
            
            if (flappyBirdGame && flappyBirdGame.gameParameterValues) {
                const apiParams = flappyBirdGame.gameParameterValues;
                const winningCriteria = flappyBirdGame.winningCriteria || {};
                
                // Set game parameters ONLY from API - no defaults
                this.gameParameters = {
                    bird_speed: apiParams.bird_speed,
                    coin_distance: apiParams.coin_distance,
                    coupon_distance: apiParams.coupon_distance,
                    vertical_pipe_gap: apiParams.vertical_pipe_gap,
                    horizontal_pipe_gap: apiParams.horizontal_pipe_gap
                };
                
                // Set winning criteria from API - no defaults
                this.winningCriteria = {
                    coins: winningCriteria.COINS,
                    coupons: winningCriteria.COUPONS
                };
                

                
                // Store the game instance ID for session updates
                this.gameInstanceId = flappyBirdGame.gameInstanceId;
                this.isOnline = true;
            } else {
                throw new Error('FLAPPY_BIRD template not found');
            }

            this.isOnline = true;
            return data;
        } catch (error) {
            this.isOnline = false;
            throw error;
        }
    }

    /**
     * Update game session with results
     * POST /api/games/sessions
     */
    async updateGameSession(gameResults) {
        if (!this.isOnline) {
            console.warn('API service offline, cannot update session');
            return null;
        }

        try {
            const sessionData = {
                customerId: this.customerId,
                gameInstanceId: this.gameInstanceId || 'flappy-bird-default',
                verdict: gameResults.verdict, // 'WON' or 'LOST'
                rewards: gameResults.rewards || []
            };

            console.log('Updating game session:', sessionData);

            const response = await fetch(`${this.baseURL}/api/games/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sessionData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Game session updated successfully:', result);
            return result;
        } catch (error) {
            console.error('Failed to update game session:', error);
            return null;
        }
    }

    /**
     * Get game parameters
     */
    getGameParameters() {
        return this.gameParameters;
    }

    /**
     * Get winning criteria
     */
    getWinningCriteria() {
        return this.winningCriteria;
    }

    /**
     * Check if service is online
     */
    isServiceOnline() {
        return this.isOnline;
    }

    /**
     * Check if API is initialized with parameters
     */
    isAPIInitialized() {
        return this.isInitialized && this.gameParameters !== null;
    }

    /**
     * Set callback to be called when API is initialized
     */
    onInitialized(callback) {
        this.onInitializedCallback = callback;
        
        // If already initialized, call immediately
        if (this.isAPIInitialized()) {
            callback();
        }
    }

    /**
     * Get current session info
     */
    getSessionInfo() {
        return {
            customerId: this.customerId,
            gameInstanceId: this.gameInstanceId,
            gameParameters: this.gameParameters,
            isOnline: this.isOnline,
            isInitialized: this.isInitialized
        };
    }
}

// Create global instance
window.gameAPI = new GameAPIService();
