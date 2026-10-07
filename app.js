// ============================================
// SINGLE FILE VIDEO DOWNLOADER WEB APP
// Save as: app.js
// Run: node app.js
// ============================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ytdl = require('ytdl-core');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 5000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ============================================
// BACKEND API ROUTES
// ============================================

// 📥 DOWNLOAD VIDEO API
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL is required' 
    });
  }

  try {
    let videoData = {};

    // 🎬 YOUTUBE SUPPORT
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const info = await ytdl.getInfo(url);
      
      const formats = info.formats
        .filter(f => f.hasVideo && f.hasAudio)
        .map(f => ({
          quality: f.qualityLabel || f.quality || 'Unknown',
          url: f.url,
          size: f.contentLength ? 
            (f.contentLength / 1024 / 1024).toFixed(2) + ' MB' : 
            'Unknown',
          container: f.container || 'Unknown',
          hasAudio: f.hasAudio,
          hasVideo: f.hasVideo
        }));

      videoData = {
        title: info.videoDetails.title,
        thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || 
                   info.videoDetails.thumbnails[0]?.url || '',
        duration: info.videoDetails.lengthSeconds,
        views: info.videoDetails.viewCount,
        author: info.videoDetails.author.name,
        formats: formats,
        source: 'YouTube'
      };
    }
    // 🌐 UNIVERSAL SITE SUPPORT (including 18+)
    else {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 30000,
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);
      
      // Extract video sources
      const videoSources = [];
      const iframeSources = [];
      
      // Video tags
      $('video source').each((i, el) => {
        const src = $(el).attr('src');
        if (src) videoSources.push(src);
      });
      
      $('video').each((i, el) => {
        const src = $(el).attr('src');
        if (src) videoSources.push(src);
      });

      // Iframe sources
      $('iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src && (src.includes('video') || src.includes('player') || 
            src.includes('embed') || src.includes('watch') || 
            src.includes('stream') || src.includes('media'))) {
          iframeSources.push(src);
        }
      });

      // Meta tags
      const metaTags = {
        title: $('meta[property="og:title"]').attr('content') || 
               $('meta[name="title"]').attr('content') ||
               $('title').text() || 'Unknown Video',
        thumbnail: $('meta[property="og:image"]').attr('content') || 
                   $('meta[property="og:image:secure_url"]').attr('content') ||
                   $('meta[name="thumbnail"]').attr('content') || '',
        description: $('meta[property="og:description"]').attr('content') || 
                     $('meta[name="description"]').attr('content') || '',
        siteName: $('meta[property="og:site_name"]').attr('content') || 
                  $('meta[name="site_name"]').attr('content') || 'Unknown'
      };

      // Combine all sources
      const allSources = [...videoSources, ...iframeSources];
      
      const formats = allSources.length > 0 ? 
        allSources.map((src, index) => ({
          quality: `Source ${index + 1}`,
          url: src.startsWith('http') ? src : new URL(src, url).href,
          size: 'Unknown',
          type: src.includes('iframe') ? 'Embed' : 'Direct'
        })) : 
        [{
          quality: 'Page URL',
          url: url,
          size: 'Unknown',
          type: 'Direct'
        }];

      videoData = {
        title: metaTags.title,
        thumbnail: metaTags.thumbnail || 'https://via.placeholder.com/300x200?text=Video+Thumbnail',
        description: metaTags.description,
        siteName: metaTags.siteName,
        formats: formats,
        source: metaTags.siteName || 'Universal'
      };
    }

    res.json({
      success: true,
      data: videoData
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download video'
    });
  }
});

// 🔍 SEARCH API with Google Dorking
app.get('/api/search/:query', async (req, res) => {
  const { query } = req.params;
  const { page = 1, limit = 30 } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }

  try {
    const searchQueries = [
      `${query} video`,
      `${query} download`,
      `${query} watch online`,
      `${query} full video`,
      `${query} 18+`, // Enables adult content search
      `${query} watch free`,
      `${query} stream`,
      `${query} video download`,
    ];

    const allResults = [];
    const startIndex = (page - 1) * 30;

    for (const searchQuery of searchQueries) {
      try {
        const response = await axios.get(
          `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&start=${startIndex}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 15000
          }
        );

        const $ = cheerio.load(response.data);
        
        $('.g').each((i, el) => {
          const title = $(el).find('h3').text().trim();
          const link = $(el).find('a').attr('href');
          const description = $(el).find('.VwiC3b').text().trim() || 
                             $(el).find('.s').text().trim() ||
                             $(el).find('.st').text().trim();

          if (title && link && link.startsWith('http')) {
            allResults.push({
              title: title,
              link: link,
              description: description || 'No description available',
              source: 'Google Search',
              type: detectContentType(link, title)
            });
          }
        });
      } catch (err) {
        // Continue with next search query if one fails
        console.log('Search sub-query failed:', searchQuery);
      }
    }

    // Remove duplicates
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.link, item])).values()
    );

    // Limit results
    const limitedResults = uniqueResults.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: limitedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: uniqueResults.length,
        totalPages: Math.ceil(uniqueResults.length / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed'
    });
  }
});

// 🏠 Serve Frontend
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Video Downloader Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh;
            color: white;
        }
        .glass {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .glass-dark {
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .gradient-text {
            background: linear-gradient(135deg, #a78bfa, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .btn-primary {
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            transform: scale(1.05);
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.4);
        }
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .tab-active {
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            color: white;
            box-shadow: 0 5px 20px rgba(139, 92, 246, 0.3);
        }
        .tab-inactive {
            background: rgba(255, 255, 255, 0.05);
            color: #9ca3af;
        }
        .tab-inactive:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        .video-card {
            transition: all 0.3s ease;
        }
        .video-card:hover {
            transform: translateY(-5px);
            border-color: #8b5cf6;
        }
        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #8b5cf6;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .fade-in {
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #8b5cf6;
        }
        .format-item {
            transition: all 0.2s ease;
        }
        .format-item:hover {
            background: rgba(139, 92, 246, 0.1);
        }
        .badge {
            font-size: 0.65rem;
            padding: 0.2rem 0.6rem;
            border-radius: 9999px;
        }
        .badge-youtube { background: rgba(255, 0, 0, 0.2); color: #ef4444; }
        .badge-adult { background: rgba(236, 72, 153, 0.2); color: #ec4899; }
        .badge-video { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .badge-unknown { background: rgba(255, 255, 255, 0.1); color: #9ca3af; }
    </style>
</head>
<body>

<div id="root"></div>

<script>
// ============================================
// REACT - COMPLETE SINGLE FILE
// ============================================

const { useState, useEffect, useRef, useCallback } = React;

// ============================================
// MAIN APP COMPONENT
// ============================================
const App = () => {
    const [activeTab, setActiveTab] = useState('download');
    const [url, setUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [videoData, setVideoData] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCopyAlert, setShowCopyAlert] = useState(false);

    // Listen for custom event to set URL from search results
    useEffect(() => {
        const handler = (e) => {
            setUrl(e.detail);
            setActiveTab('download');
        };
        window.addEventListener('setDownloadUrl', handler);
        return () => window.removeEventListener('setDownloadUrl', handler);
    }, []);

    // Handle download
    const handleDownload = async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        setVideoData(null);

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await response.json();
            
            if (data.success) {
                setVideoData(data.data);
            } else {
                setError(data.error || 'Download failed');
            }
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // Handle search
    const handleSearch = async () => {
        if (!searchQuery) return;
        setLoading(true);
        setError(null);
        setSearchResults([]);

        try {
            const response = await fetch(`/api/search/${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            
            if (data.success) {
                setSearchResults(data.data || []);
            } else {
                setError(data.error || 'Search failed');
            }
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // Copy to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            setShowCopyAlert(true);
            setTimeout(() => setShowCopyAlert(false), 2000);
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setShowCopyAlert(true);
            setTimeout(() => setShowCopyAlert(false), 2000);
        });
    };

    // Detect content type
    const detectType = (url, title) => {
        const urlLower = url.toLowerCase();
        const titleLower = title.toLowerCase();
        
        if (urlLower.includes('youtube') || urlLower.includes('youtu.be')) return 'YouTube';
        if (urlLower.includes('vimeo')) return 'Vimeo';
        if (urlLower.includes('dailymotion')) return 'Dailymotion';
        if (urlLower.includes('twitch')) return 'Twitch';
        if (urlLower.includes('facebook')) return 'Facebook';
        if (urlLower.includes('instagram')) return 'Instagram';
        if (titleLower.includes('18+') || titleLower.includes('adult') || 
            titleLower.includes('xxx') || titleLower.includes('porn')) return 'Adult Content';
        if (urlLower.includes('video') || urlLower.includes('watch') || 
            urlLower.includes('stream') || urlLower.includes('media')) return 'Video';
        return 'Unknown';
    };

    // Get badge class
    const getBadgeClass = (type) => {
        switch(type) {
            case 'YouTube': return 'badge-youtube';
            case 'Adult Content': return 'badge-adult';
            case 'Video': return 'badge-video';
            default: return 'badge-unknown';
        }
    };

    // Format views
    const formatViews = (views) => {
        if (!views) return '';
        if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M views';
        if (views >= 1000) return (views / 1000).toFixed(1) + 'K views';
        return views + ' views';
    };

    return (
        <div className="min-h-screen py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="text-center mb-10">
                    <h1 className="text-5xl md:text-6xl font-bold mb-2 flex items-center justify-center gap-3">
                        <i className="fas fa-globe text-purple-400 text-4xl"></i>
                        <span className="gradient-text">Video Downloader Pro</span>
                    </h1>
                    <p className="text-gray-300 text-lg">Download any video from any website</p>
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                        <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                            ⚡ Fast
                        </span>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                            🔒 Secure
                        </span>
                        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                            🌐 Universal
                        </span>
                        <span className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-sm">
                            🔞 18+ Support
                        </span>
                    </div>
                </header>

                {/* Tabs */}
                <div className="flex justify-center gap-3 mb-8">
                    <button
                        onClick={() => setActiveTab('download')}
                        className={\`px-6 py-3 rounded-full font-semibold transition-all \${activeTab === 'download' ? 'tab-active' : 'tab-inactive'}\`}
                    >
                        <i className="fas fa-download mr-2"></i> Download
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={\`px-6 py-3 rounded-full font-semibold transition-all \${activeTab === 'search' ? 'tab-active' : 'tab-inactive'}\`}
                    >
                        <i className="fas fa-search mr-2"></i> Search
                    </button>
                </div>

                {/* Alert */}
                {showCopyAlert && (
                    <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg fade-in">
                        <i className="fas fa-check-circle mr-2"></i> Link copied!
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-300">
                        <i className="fas fa-exclamation-circle mr-2"></i> {error}
                    </div>
                )}

                {/* Download Tab */}
                {activeTab === 'download' && (
                    <div className="glass rounded-2xl p-6 mb-8">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Paste video URL here (YouTube, Vimeo, etc.)"
                                className="flex-1 bg-black/30 text-white px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                            />
                            <button
                                onClick={handleDownload}
                                disabled={loading || !url}
                                className="btn-primary px-8 py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><span className="spinner inline-block"></span> Processing...</>
                                ) : (
                                    <><i className="fas fa-download"></i> Download</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Search Tab */}
                {activeTab === 'search' && (
                    <div className="glass rounded-2xl p-6 mb-8">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search any video (including 18+ content)"
                                className="flex-1 bg-black/30 text-white px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={loading || !searchQuery}
                                className="btn-primary px-8 py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><span className="spinner inline-block"></span> Searching...</>
                                ) : (
                                    <><i className="fas fa-search"></i> Search</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Video Preview */}
                {videoData && activeTab === 'download' && (
                    <div className="glass rounded-2xl p-6 fade-in">
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="lg:w-1/3">
                                <img
                                    src={videoData.thumbnail || 'https://via.placeholder.com/300x200?text=No+Thumbnail'}
                                    alt={videoData.title}
                                    className="w-full rounded-xl shadow-lg"
                                    onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/300x200?text=No+Thumbnail';
                                    }}
                                />
                                <h3 className="text-white font-bold mt-3 line-clamp-2">
                                    {videoData.title}
                                </h3>
                                {videoData.source && (
                                    <span className={\`inline-block mt-2 px-3 py-1 rounded-full text-sm \${getBadgeClass(videoData.source)}\`}>
                                        {videoData.source}
                                    </span>
                                )}
                                {videoData.author && (
                                    <p className="text-gray-400 text-sm mt-1">
                                        <i className="fas fa-user mr-1"></i> {videoData.author}
                                    </p>
                                )}
                                {videoData.views && (
                                    <p className="text-gray-400 text-sm">
                                        <i className="fas fa-eye mr-1"></i> {formatViews(videoData.views)}
                                    </p>
                                )}
                                {videoData.duration && (
                                    <p className="text-gray-400 text-sm">
                                        <i className="fas fa-clock mr-1"></i> {Math.floor(videoData.duration / 60)}:{(videoData.duration % 60).toString().padStart(2, '0')}
                                    </p>
                                )}
                            </div>
                            <div className="lg:w-2/3">
                                <h4 className="text-purple-300 font-semibold mb-4 flex items-center gap-2">
                                    <i className="fas fa-list"></i> Available Formats ({videoData.formats?.length || 0})
                                </h4>
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {videoData.formats?.map((format, index) => (
                                        <div
                                            key={index}
                                            className="format-item bg-black/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div>
                                                <span className="text-white font-medium">{format.quality}</span>
                                                <span className="text-gray-400 text-sm ml-3">{format.size}</span>
                                                {format.type && (
                                                    <span className="text-gray-500 text-xs ml-2">({format.type})</span>
                                                )}
                                                {format.container && (
                                                    <span className="text-gray-500 text-xs ml-2">• {format.container}</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                <button
                                                    onClick={() => window.open(format.url, '_blank')}
                                                    className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition text-sm flex items-center gap-1"
                                                >
                                                    <i className="fas fa-play"></i> Preview
                                                </button>
                                                <a
                                                    href={format.url}
                                                    download
                                                    className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition text-sm flex items-center gap-1"
                                                >
                                                    <i className="fas fa-download"></i> Download
                                                </a>
                                                <button
                                                    onClick={() => copyToClipboard(format.url)}
                                                    className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm flex items-center gap-1"
                                                >
                                                    <i className="fas fa-copy"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search Results */}
                {activeTab === 'search' && (
                    <div>
                        {searchResults.length === 0 && !loading && searchQuery && (
                            <div className="text-center text-gray-400 py-12 glass rounded-2xl">
                                <p className="text-4xl mb-3">🔍</p>
                                <p className="text-xl">No results found</p>
                                <p className="text-sm mt-1">Try different keywords</p>
                            </div>
                        )}

                        {searchResults.length === 0 && !loading && !searchQuery && (
                            <div className="text-center text-gray-400 py-12 glass rounded-2xl">
                                <p className="text-4xl mb-3">🔎</p>
                                <p className="text-xl">Search for videos</p>
                                <p className="text-sm mt-1">Enter keywords to find videos from across the web</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {searchResults.map((result, index) => {
                                const type = detectType(result.link, result.title);
                                return (
                                    <div
                                        key={index}
                                        className="video-card glass-dark rounded-xl p-4 border border-white/5 hover:border-purple-500/50 transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <span className={\`badge \${getBadgeClass(type)}\`}>
                                                {type === 'YouTube' && <i className="fab fa-youtube mr-1"></i>}
                                                {type === 'Adult Content' && <i className="fas fa-exclamation-triangle mr-1"></i>}
                                                {type}
                                            </span>
                                            <span className="text-gray-500 text-xs">#{index + 1}</span>
                                        </div>
                                        <h4 className="text-white font-semibold line-clamp-2 mb-2">
                                            {result.title}
                                        </h4>
                                        <p className="text-gray-400 text-sm line-clamp-3 mb-3">
                                            {result.description}
                                        </p>
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('setDownloadUrl', { 
                                                        detail: result.link 
                                                    }));
                                                }}
                                                className="flex-1 px-3 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition text-sm flex items-center justify-center gap-1"
                                            >
                                                <i className="fas fa-download"></i> Download
                                            </button>
                                            <button
                                                onClick={() => window.open(result.link, '_blank')}
                                                className="px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition text-sm flex items-center gap-1"
                                            >
                                                <i className="fas fa-external-link-alt"></i>
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(result.link)}
                                                className="px-3 py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm"
                                            >
                                                <i className="fas fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {searchResults.length > 0 && (
                            <div className="text-center text-gray-400 text-sm mt-6">
                                <i className="fas fa-info-circle mr-1"></i> 
                                Showing {searchResults.length} results
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <footer className="text-center text-gray-500 text-sm mt-12 pt-6 border-t border-white/5">
                    <p>
                        <i className="fas fa-shield-alt text-purple-400 mr-1"></i> 
                        Video Downloader Pro • All rights reserved
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                        For educational purposes only. Please respect copyright laws.
                    </p>
                </footer>
            </div>
        </div>
    );
};

// ============================================
// RENDER REACT APP
// ============================================
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

</script>

<!-- Load React -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

</body>
</html>
  `);
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🚀 Video Downloader Pro Server Started!            ║
║                                                      ║
║   📡 Server: http://localhost:${PORT}                   ║
║                                                      ║
║   🔥 Features:                                      ║
║   - YouTube Download Support                         ║
║   - Universal Video Download                        ║
║   - Google Search Integration                       ║
║   - 18+ Content Support                             ║
║   - Beautiful UI                                   ║
║                                                      ║
║   Press Ctrl+C to stop                               ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);
});