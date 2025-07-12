/**
 * Game API Service for Flappy Bird backend integration
 * API Service for Flappy Bird Game
 * Fetches game parameters from backend API
 */

class GameAPIService {
    constructor() {
        this.baseURL = 'https://arcadex-platform.loca.lt/user-engagement-platform';
        this.customerId = 'shivam'; // Fixed customer ID as per your example
        this.gameInstanceId = null; // Will be set from FLAPPY_BIRD template
        this.gameParameters = null; // Will be set from API only
        this.winningCriteria = null; // Will be set from API only
        this.activeGameSession = null; // Current active session
        this.canResume = false; // Whether game can be resumed
        this.revivalReasonsUnlocked = []; // Available revival reasons
        this.revivalReasonsLocked = []; // Locked revival reasons
        this.revivals = []; // Used revivals
        this.isOnline = false;
        this.isInitialized = false;
        this.onInitializedCallback = null;
        this.onSyncCompleteCallback = null; // Callback for when sync completes after session update
        
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
                

                
                // Store the game instance ID and session info
                this.gameInstanceId = flappyBirdGame.gameInstanceId;
                this.activeGameSession = flappyBirdGame.activeGameSession;
                this.canResume = flappyBirdGame.canResume || false;
                
                // Extract revival information from activeGameSession
                if (this.activeGameSession) {
                    this.revivalReasonsUnlocked = this.activeGameSession.revivalReasonsUnlocked || [];
                    this.revivalReasonsLocked = this.activeGameSession.revivalReasonsLocked || [];
                    this.revivals = this.activeGameSession.revivals || [];
                } else {
                    this.revivalReasonsUnlocked = [];
                    this.revivalReasonsLocked = [];
                    this.revivals = [];
                }
                
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
     * Update game session with results and sync new state
     * POST /api/games/sessions
     */
    async updateGameSession(gameResults) {
        if (!this.isOnline) {
            return false;
        }

        try {
            // Prepare rewards array with COINS and COUPONS
            const rewards = [
                {
                    rewardType: "COINS",
                    count: gameResults.coins || 0
                },
                {
                    rewardType: "COUPONS", 
                    count: gameResults.coupons || 0
                }
            ];

            const sessionData = {
                customerId: this.customerId,
                gameInstanceId: this.gameInstanceId,
                verdict: gameResults.verdict, // 'WON' or 'LOST'
                rewards: rewards
            };
            
            // Only include gameSessionId if there's an active session and revive was used
            if (this.activeGameSession && gameResults.reviveUsed) {
                sessionData.gameSessionId = this.activeGameSession.sessionId;
            }

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
            
            // After session update, sync again to get updated state
            await this.syncGameParameters();
            
            // Notify game that sync is complete and UI should be updated
            if (this.onSyncCompleteCallback) {
                this.onSyncCompleteCallback();
            }
            
            return result;
        } catch (error) {
            this.isOnline = false;
            return false;
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
     * Check if game can be resumed
     */
    canResumeGame() {
        return this.canResume && this.activeGameSession !== null;
    }

    /**
     * Get active game session data
     */
    getActiveGameSession() {
        return this.activeGameSession;
    }

    /**
     * Check if revivals are available
     */
    hasRevivalsAvailable() {
        return this.revivalReasonsUnlocked.length > 0;
    }

    /**
     * Get unlocked revival reasons
     */
    getUnlockedRevivalReasons() {
        return this.revivalReasonsUnlocked;
    }

    /**
     * Get locked revival reasons
     */
    getLockedRevivalReasons() {
        return this.revivalReasonsLocked;
    }

    /**
     * Get used revivals count
     */
    getUsedRevivalsCount() {
        return this.revivals.length;
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
     * Set callback for when sync completes after session update
     */
    onSyncComplete(callback) {
        this.onSyncCompleteCallback = callback;
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
