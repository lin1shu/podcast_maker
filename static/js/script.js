document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ttsForm');
    const resultCard = document.getElementById('resultCard');
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadBtn = document.getElementById('downloadBtn');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    const loadingAlert = document.getElementById('loadingAlert');
    const loadingMessage = document.getElementById('loadingMessage');
    const convertChineseBtn = document.getElementById('convertChineseBtn');
    const showChunksBtn = document.getElementById('showChunksBtn');
    
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
    
    // Create chunk text display div
    const chunkTextDiv = document.createElement('div');
    chunkTextDiv.id = 'chunkText';
    chunkTextDiv.className = 'card mt-3';
    chunkTextDiv.style.display = 'none';
    resultCard.appendChild(chunkTextDiv);
    
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
    
    // Setup chunk cards layout
    chunkTextDiv.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Text Segments</h5>
            <span id="chunkCounter" class="badge bg-primary">0/0</span>
        </div>
        <div class="card-body">
            <div class="current-segment">
                <h6 class="mb-2">Current Segment</h6>
                <div id="currentOriginalText" class="p-2 border rounded mb-2"></div>
                <div id="currentTranslatedContainer" class="mb-3" style="display: none;">
                    <h6>Chinese Translation:</h6>
                    <div id="currentTranslatedText" class="p-2 bg-light border rounded"></div>
                </div>
            </div>
            <hr class="my-3">
            <div class="next-segment" style="display: none;">
                <h6 class="mb-2">Next Segment (Preparing...)</h6>
                <div id="nextOriginalText" class="p-2 border rounded mb-2"></div>
                <div id="nextTranslatedContainer" class="mb-3" style="display: none;">
                    <h6>Chinese Translation:</h6>
                    <div id="nextTranslatedText" class="p-2 bg-light border rounded"></div>
                </div>
            </div>
        </div>
    `;
    
    // Get the new elements
    const chunkCounter = document.getElementById('chunkCounter');
    const currentOriginalText = document.getElementById('currentOriginalText');
    const currentTranslatedContainer = document.getElementById('currentTranslatedContainer');
    const currentTranslatedText = document.getElementById('currentTranslatedText');
    const nextSegmentDiv = document.querySelector('.next-segment');
    const nextOriginalText = document.getElementById('nextOriginalText');
    const nextTranslatedContainer = document.getElementById('nextTranslatedContainer');
    const nextTranslatedText = document.getElementById('nextTranslatedText');
    
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
    
    // Handle form submission for regular speech
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        processText(false);
    });
    
    // Handle Chinese translation and speech
    convertChineseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        processText(true);
    });
    
    // Handle text chunks display
    showChunksBtn.addEventListener('click', function(e) {
        e.preventDefault();
        processTextChunks();
    });
    
    // Handle next chunk button
    nextChunkBtn.addEventListener('click', function() {
        getNextTextChunk();
    });
    
    // Function to process text chunks
    function processTextChunks() {
        // Reset UI state
        resetUI();
        
        // Update and show loading indicator
        loadingMessage.textContent = 'Processing text into chunks...';
        loadingAlert.style.display = 'block';
        
        // Check if there's text to convert
        const text = document.getElementById('text').value.trim();
        if (!text) {
            showError('Please enter some text to process.');
            return;
        }
        
        // Create form data
        const formData = new FormData();
        formData.append('text', text);
        
        // Send API request
        fetch('/chunk_text_only', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading indicator
            loadingAlert.style.display = 'none';
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            // Show results card
            resultCard.style.display = 'block';
            
            // Handle chunked content
            if (data.is_chunked) {
                // Store session ID for future requests
                textSessionId = data.session_id;
                simpleCurrentChunk = 0;
                simpleTotalChunks = data.total_chunks;
                
                // Update chunk info
                simpleChunkDiv.style.display = 'block';
                simpleChunkCounter.textContent = `0/${data.total_chunks}`;
                chunkContent.textContent = 'Click "Show Next Chunk" to display the first chunk.';
                
                console.log(`Text will be processed in ${data.total_chunks} chunks.`);
            } else {
                // Single chunk (show directly)
                simpleChunkDiv.style.display = 'block';
                simpleChunkCounter.textContent = `1/1`;
                chunkContent.textContent = data.chunk;
                nextChunkBtn.style.display = 'none';
            }
        })
        .catch(error => {
            loadingAlert.style.display = 'none';
            showError('An error occurred: ' + error.message);
        });
    }
    
    // Function to get the next text chunk
    function getNextTextChunk() {
        // Show loading indicator
        loadingMessage.textContent = 'Loading next chunk...';
        loadingAlert.style.display = 'block';
        
        // Send request to get the next chunk
        fetch('/get_next_text_chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: textSessionId
            })
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading indicator
            loadingAlert.style.display = 'none';
            
            if (data.error) {
                // Special handling for "All chunks have been processed" error
                if (data.error.includes("All chunks have been processed")) {
                    console.log("All chunks processed");
                    chunkContent.textContent = "All chunks have been displayed.";
                    nextChunkBtn.disabled = true;
                    return;
                }
                
                showError(data.error);
                return;
            }
            
            // Update chunk counter and content
            simpleCurrentChunk = data.current_chunk;
            simpleChunkCounter.textContent = `${data.current_chunk}/${data.total_chunks}`;
            chunkContent.textContent = data.chunk;
            
            // Disable button if this is the last chunk
            if (data.is_last_chunk) {
                nextChunkBtn.disabled = true;
                nextChunkBtn.textContent = 'All Chunks Displayed';
            }
        })
        .catch(error => {
            loadingAlert.style.display = 'none';
            showError('An error occurred: ' + error.message);
        });
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
        
        // Validate input
        const text = document.getElementById('text').value.trim();
        if (!text) {
            showError('Please enter some text to convert.');
            return;
        }
        
        // Prepare request data
        const requestData = {
            is_first_chunk: true,
            text: text,
            voice: document.getElementById('voice').value,
            tone: document.getElementById('tone').value,
            is_chinese: isChineseConversion
        };
        
        // Send request to process the first chunk
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
        
        // Use the existing elements from the page structure
        const currentOriginalText = document.getElementById('currentOriginalText');
        const currentTranslatedContainer = document.getElementById('currentTranslatedContainer');
        const currentTranslatedText = document.getElementById('currentTranslatedText');
        
        // Show the chunk text display
        chunkTextDiv.style.display = 'block';
        
        // Update the original text
        if (currentOriginalText) {
            console.log("Setting original text:", chunkInfo.original_text);
            currentOriginalText.textContent = chunkInfo.original_text;
        } else {
            console.warn("Could not find currentOriginalText element");
        }
        
        // Handle translation for Chinese mode
        if (isChinese && chunkInfo.translated_text) {
            if (currentTranslatedText && currentTranslatedContainer) {
                console.log("Setting translated text:", chunkInfo.translated_text);
                // Show translation
                currentTranslatedContainer.style.display = 'block';
                currentTranslatedText.textContent = chunkInfo.translated_text;
                
                // After a delay, hide original and show only translation if desired
                // (Uncomment this if you want to hide original after translation)
                /*
                setTimeout(() => {
                    if (currentOriginalText) currentOriginalText.style.display = 'none';
                }, 2000);
                */
            } else {
                console.warn("Could not find translation elements");
            }
        } else {
            // For English mode, hide translation container
            if (currentTranslatedContainer) {
                currentTranslatedContainer.style.display = 'none';
            }
        }
        
        // Update audio player and download link
        audioPlayer.src = chunkInfo.audio_url;
        downloadBtn.href = '/download/' + chunkInfo.filename;
        
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
        
        if (chunkProgress) {
            chunkProgress.style.display = 'none';
        }
        
        if (translatedTextContainer) {
            translatedTextContainer.style.display = 'none';
        }
        
        // Reset audio
        audioPlayer.src = '';
        downloadBtn.href = '#';
        
        // Reset processing state
        processingComplete = false;
        processingPaused = false;
        currentChunkIndex = 0;
        totalChunks = 0;
        processedChunks = [];
    }
}); 