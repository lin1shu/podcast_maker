document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ttsForm');
    const resultCard = document.getElementById('resultCard');
    const audioPlayer = document.getElementById('audioPlayer');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    const loadingAlert = document.getElementById('loadingAlert');
    const loadingMessage = document.getElementById('loadingMessage');
    const convertChineseBtn = document.getElementById('convertChineseBtn');
    const showChunksBtn = document.getElementById('showChunksBtn');
    
    // Initialize the originalText element with a starting message
    const originalText = document.getElementById('originalText');
    if (originalText) {
        originalText.textContent = 'Enter text and click "Show Chunks" to display text chunks here.';
        console.log('Initialized originalText element');
    } else {
        console.log('originalText element not found - this is expected after UI update');
    }
    
    // Initialize the resultCard display
    resultCard.style.display = 'block';
    
    // Create translation display div
    const translationDiv = document.createElement('div');
    translationDiv.id = 'translationResult';
    translationDiv.className = 'alert alert-info mt-3';
    translationDiv.style.display = 'none';
    resultCard.appendChild(translationDiv);
    
    // Create chunk info display div
    const chunkInfoDiv = document.createElement('div');
    chunkInfoDiv.id = 'chunkInfo';
    chunkInfoDiv.className = 'alert alert-secondary mt-3';
    chunkInfoDiv.style.display = 'none';
    resultCard.appendChild(chunkInfoDiv);
    
    // Create a simple text chunk display area
    const simpleChunkDiv = document.createElement('div');
    simpleChunkDiv.id = 'simpleChunkText';
    simpleChunkDiv.className = 'card mt-3';
    simpleChunkDiv.style.display = 'none';
    simpleChunkDiv.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Text Chunks</h5>
            <span id="simpleChunkCounter" class="badge bg-primary">0/0</span>
        </div>
        <div class="card-body">
            <div id="chunkContent" class="p-3 border rounded mb-3"></div>
            <button id="nextChunkBtn" class="btn btn-primary">Show Next Chunk</button>
        </div>
    `;
    resultCard.appendChild(simpleChunkDiv);
    
    // Get the simple chunk elements
    const simpleChunkCounter = document.getElementById('simpleChunkCounter');
    const chunkContent = document.getElementById('chunkContent');
    const nextChunkBtn = document.getElementById('nextChunkBtn');
    
    // Create progress bar for chunk processing
    const chunkProgressDiv = document.createElement('div');
    chunkProgressDiv.id = 'chunkProgress';
    chunkProgressDiv.className = 'mt-3';
    chunkProgressDiv.style.display = 'none';
    chunkProgressDiv.innerHTML = `
        <h6>Processing Progress</h6>
        <div class="d-flex justify-content-between align-items-center mb-1">
            <span>Progress:</span>
            <span><span id="currentChunkDisplay">0</span>/<span id="totalChunkDisplay">0</span></span>
        </div>
        <div class="progress">
            <div id="progressBar" class="progress-bar" role="progressbar" style="width: 0%" 
                aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
        </div>
    `;
    resultCard.appendChild(chunkProgressDiv);
    
    // Get progress elements
    const chunkProgress = document.getElementById('chunkProgress');
    const progressBar = document.getElementById('progressBar');
    const currentChunkDisplay = document.getElementById('currentChunkDisplay');
    const totalChunkDisplay = document.getElementById('totalChunkDisplay');
    
    // Create translated text container
    const translatedTextContainer = document.createElement('div');
    translatedTextContainer.id = 'translatedTextContainer';
    translatedTextContainer.className = 'mt-3';
    translatedTextContainer.style.display = 'none';
    resultCard.appendChild(translatedTextContainer);
    
    // Session variables
    let sessionId = null;
    let isChinese = false;
    let currentChunkIndex = 0;
    let totalChunks = 0;
    let isProcessingChunk = false;
    let nextChunkData = null;
    let processingPaused = false;
    let processingComplete = false;
    let processedChunks = [];
    
    // Simple chunk variables
    let textSessionId = null;
    let simpleCurrentChunk = 0;
    let simpleTotalChunks = 0;
    
    // Add event listener for when audio finishes playing
    audioPlayer.addEventListener('ended', function() {
        if (nextChunkData) {
            // Play the next chunk that was prepared while current chunk was playing
            playPreparedChunk();
        } else if (currentChunkIndex < totalChunks) {
            // Process the next chunk if we haven't reached the end
            processNextChunk();
        }
    });
    
    // Function to play prepared chunk
    function playPreparedChunk() {
        if (!nextChunkData) return;
        
        // Update display with the prepared chunk
        displaySingleChunk(nextChunkData);
        
        // Clear the prepared chunk
        nextChunkData = null;
        
        // Prepare the next chunk if we haven't reached the end
        if (currentChunkIndex < totalChunks) {
            prepareNextChunk();
        }
    }
    
    // Function to prepare next chunk in background
    function prepareNextChunk() {
        if (isProcessingChunk || processingComplete) return;
        
        isProcessingChunk = true;
        
        fetch('/process_chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                is_first_chunk: false
            })
        })
        .then(response => response.json())
        .then(data => {
            isProcessingChunk = false;
            
            if (data.error) {
                if (data.error.includes('No more chunks to process')) {
                    processingComplete = true;
                    updateProgressStatus(totalChunks, totalChunks);
                    return;
                }
                
                console.error('Error preparing next chunk:', data.error);
                return;
            }
            
            // Store the prepared chunk data
            nextChunkData = data.chunk_info;
            currentChunkIndex = data.current_chunk;
            
            // Update progress indicators
            updateProgressStatus(currentChunkIndex, totalChunks);
            
            if (data.is_last_chunk) {
                processingComplete = true;
            }
        })
        .catch(error => {
            isProcessingChunk = false;
            console.error('Error preparing next chunk:', error);
        });
    }
    
    // Set up event listeners for main buttons
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        processText(false);
    });
    
    // Handle Convert button click
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.addEventListener('click', function(e) {
            e.preventDefault();
            processText(false);
        });
    }
    
    // Handle Chinese translation and speech
    if (convertChineseBtn) {
        convertChineseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            processText(true);
        });
    }
    
    // Handle text chunks display - no longer used, but kept for compatibility
    if (showChunksBtn) {
        showChunksBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Show Chunks functionality has been removed");
        });
    }
    
    // Handle event listener setup for buttons
    function setupButtonListeners() {
        // Try to find the buttons, if they exist in the DOM
        const nextChunkBtn = document.getElementById('nextChunkBtn');
        if (nextChunkBtn) {
            nextChunkBtn.addEventListener('click', function() {
                console.log("Next chunk button is no longer used");
            });
        }
        
        const translateChunkBtn = document.getElementById('translateChunkBtn');
        if (translateChunkBtn) {
            translateChunkBtn.addEventListener('click', function() {
                console.log("Translate chunk button is no longer used");
            });
        }
    }
    
    // Set up listeners
    setupButtonListeners();
    
    // Function to process text chunks - stub for compatibility
    function processTextChunks() {
        console.log("Text chunk processing is no longer used");
    }
    
    // Function to process text (main entry point)
    function processText(isChineseConversion) {
        // Reset state
        resetUI();
        
        // Store Chinese conversion flag
        isChinese = isChineseConversion;
        
        // Show loading state
        const actionText = isChineseConversion ? 
            'Translating text to Chinese and converting to speech...' : 
            'Converting text to speech...';
        showLoading(actionText);
        
        // Get form values
        const text = document.getElementById('text').value;
        const voice = document.getElementById('voice').value;
        const tone = document.getElementById('tone').value;
        
        // Get source URL with extra checks to ensure it's working
        let sourceUrl = '';
        const sourceUrlElement = document.getElementById('sourceUrl');
        if (sourceUrlElement) {
            sourceUrl = sourceUrlElement.value || '';
            console.log("Found sourceUrl element with value:", sourceUrl);
        } else {
            console.log("sourceUrl element not found");
        }
        
        // Additional debug log
        console.log("Source URL value being sent:", sourceUrl);
        
        if (text.trim() === '') {
            showError('Please enter some text to convert to speech.');
            return;
        }
        
        // Create the request data object
        const requestData = {
            text: text,
            voice: voice,
            tone: tone,
            is_chinese: isChineseConversion,
            is_first_chunk: true
        };
        
        // Add source_url only if it has a value
        if (sourceUrl) {
            requestData.source_url = sourceUrl;
        }
        
        console.log("Final request data:", requestData);
        
        // Process the entire text
        fetch('/process_chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            // Show results card
            resultCard.style.display = 'block';
            
            // Handle chunked content
            if (data.is_chunked) {
                // Initialize processing state
                totalChunks = data.total_chunks;
                currentChunkIndex = 0;
                processedChunks = [];
                
                // Setup and show progress indicators
                setupChunkProgress(totalChunks);
                
                // Start processing the first chunk
                processNextChunk();
            } else {
                // Single chunk processing
                totalChunks = 1;
                currentChunkIndex = 1;
                
                // Display the single chunk
                const chunkInfo = data.chunk_info;
                displaySingleChunk(chunkInfo);
            }
        })
        .catch(error => {
            hideLoading();
            showError('An error occurred: ' + error.message);
            console.error(error);
        });
    }
    
    // Function to process the next chunk
    function processNextChunk() {
        if (processingPaused || processingComplete) return;
        
        showLoading('Processing next chunk...');
        
        // Send request to process the next chunk
        fetch('/process_chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                is_first_chunk: false
            })
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.error) {
                if (data.error.includes('No more chunks to process')) {
                    processingComplete = true;
                    updateProgressStatus(totalChunks, totalChunks);
                    return;
                }
                
                showError(data.error);
                processingPaused = true;
                return;
            }
            
            // Update chunk index
            currentChunkIndex = data.current_chunk;
            
            // Store the processed chunk
            const chunkInfo = data.chunk_info;
            processedChunks.push(chunkInfo);
            
            // Display the chunk
            displaySingleChunk(chunkInfo);
            
            // Update progress indicators
            updateProgressStatus(currentChunkIndex, totalChunks);
            
            // If this is the last chunk, mark as complete
            if (data.is_last_chunk) {
                processingComplete = true;
            }
        })
        .catch(error => {
            hideLoading();
            showError('An error occurred: ' + error.message);
            processingPaused = true;
            console.error(error);
        });
    }
    
    // Function to display a single chunk result
    function displaySingleChunk(chunkInfo) {
        console.log("Displaying chunk:", chunkInfo);
        
        // Update audio player
        audioPlayer.src = chunkInfo.audio_url;
        
        // Always keep translation hidden, regardless of whether translation is available
        translationDiv.style.display = 'none';
        
        // Automatically play the audio
        audioPlayer.play().catch(e => {
            console.error("Audio play failed:", e);
        });
    }
    
    // Function to setup chunk progress display
    function setupChunkProgress(total) {
        totalChunkDisplay.textContent = total;
        currentChunkDisplay.textContent = 0;
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        chunkProgress.style.display = 'block';
    }
    
    // Function to update progress status
    function updateProgressStatus(current, total) {
        const percentComplete = Math.round((current / total) * 100);
        currentChunkDisplay.textContent = current;
        progressBar.style.width = percentComplete + '%';
        progressBar.textContent = percentComplete + '%';
        
        // Update aria values
        progressBar.setAttribute('aria-valuenow', percentComplete);
    }
    
    // Helper function to show loading message
    function showLoading(message) {
        loadingMessage.textContent = message;
        loadingAlert.style.display = 'block';
    }
    
    // Helper function to hide loading message
    function hideLoading() {
        loadingAlert.style.display = 'none';
    }
    
    // Helper function to show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorAlert.style.display = 'block';
        hideLoading();
    }
    
    // Helper function to reset UI state
    function resetUI() {
        resultCard.style.display = 'none';
        errorAlert.style.display = 'none';
        loadingAlert.style.display = 'none';
        
        // Hide translation display
        translationDiv.style.display = 'none';
        
        // Hide chunking-related elements
        if (chunkProgress) {
            chunkProgress.style.display = 'none';
        }
        
        // Reset audio
        audioPlayer.src = '';
        
        // Reset processing state
        processingComplete = false;
        processingPaused = false;
        currentChunkIndex = 0;
        totalChunks = 0;
        processedChunks = [];
    }
    
    // Function to translate text via API
    function translateText(text) {
        if (!text) return;
        
        const sourceUrl = document.getElementById('sourceUrl').value;
        
        showLoading('Translating text to Chinese...');
        
        fetch('/translate_text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                source_url: sourceUrl
            })
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            const translationDiv = document.getElementById('translationResult');
            if (translationDiv) {
                translationDiv.textContent = data.translated_text;
                translationDiv.style.display = 'block';
            }
            
            resultCard.style.display = 'block';
        })
        .catch(error => {
            hideLoading();
            showError('Error translating text: ' + error.message);
        });
    }
}); 