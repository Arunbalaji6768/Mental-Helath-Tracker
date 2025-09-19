# 💝 Mental Health Tracker

A comprehensive full-stack application for tracking mental health with AI-powered sentiment analysis.

## 🌟 Features

### 🧠 AI-Powered Sentiment Analysis
- **Real-time Analysis**: Automatically analyzes journal entries using fine-tuned DistilBERT model
- **Sentiment Classification**: POSITIVE, NEGATIVE, NEUTRAL with confidence scores
- **Custom Model**: Fine-tuned on mental health datasets for better accuracy

### 📝 Journal Management
- **Smart Entry Form**: Mood rating (1-10), tags, and text input
- **Advanced Search**: Search entries by content with real-time filtering
- **Sentiment Filtering**: Filter entries by sentiment type
- **CRUD Operations**: Create, read, update, and delete journal entries

### 📊 Analytics Dashboard
- **Interactive Charts**: Beautiful pie charts and line graphs
- **Sentiment Distribution**: Visual breakdown of emotional patterns
- **Trend Analysis**: Daily and weekly sentiment trends
- **Mood Tracking**: Average mood ratings over time
- **Personalized Insights**: AI-generated recommendations and insights

### 🎨 Modern UI/UX
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Clean Interface**: Simple and intuitive user experience
- **Multiple Pages**: Comprehensive set of pages for different features

## 🚀 Technology Stack

### Backend
- **Flask**: Python web framework
- **PostgreSQL**: Production-ready database
- **SQLAlchemy**: ORM for database operations
- **JWT Authentication**: Secure user authentication
- **HuggingFace Transformers**: AI sentiment analysis
- **Flask-CORS**: Cross-origin resource sharing
- **Flask-Limiter**: Rate limiting for API protection

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with animations
- **JavaScript**: Interactive functionality
- **Responsive Design**: Mobile-first approach

### AI/ML
- **DistilBERT**: Pre-trained transformer model
- **PyTorch**: Deep learning framework
- **Custom Fine-tuning**: Trained on mental health datasets
- **Real-time Inference**: Fast sentiment analysis

## 📁 Project Structure

```
mental-health-tracker/
├── backend/
│   ├── app.py                 # Flask application
│   ├── config.py             # Configuration
│   ├── models.py             # Database models
│   ├── routes/               # API endpoints
│   │   ├── auth.py          # Authentication
│   │   ├── journal.py       # Journal management
│   │   └── analytics.py     # Analytics & insights
│   ├── utils/
│   │   └── sentiment.py     # AI sentiment analysis
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── css/
│   │   └── style.css        # Main stylesheet
│   ├── js/
│   │   └── common.js        # JavaScript functionality
│   └── pages/               # HTML pages
│       ├── index.html       # Home page
│       ├── login.html       # Login page
│       ├── signup.html      # Registration page
│       ├── dashboard.html   # Main dashboard
│       ├── journal.html     # Journal entries
│       ├── analytics.html   # Analytics dashboard
│       └── [other pages]    # Additional features
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.8+
- PostgreSQL 12+

### Backend Setup
```bash
cd mental-health-tracker/backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app.py
```

### Frontend Setup
```bash
# Simply open the HTML files in a web browser
# Or use a local server:
cd mental-health-tracker/frontend
python -m http.server 8000
# Then open http://localhost:8000
```

### Database Setup
```bash
# Create PostgreSQL database
createdb mht

# Run migration script
python migrate_sqlite_to_postgres.py
```

## 🎯 Key Features

### 1. **AI Integration**
- Custom fine-tuned sentiment analysis model
- Real-time emotional state detection
- Personalized mental health insights

### 2. **User Interface**
- Clean, responsive HTML/CSS design
- Intuitive navigation between pages
- Mobile-friendly layout

### 3. **Data Management**
- Journal entry creation and management
- Mood tracking with visual indicators
- Search and filter functionality

### 4. **Analytics**
- Sentiment distribution visualization
- Trend analysis over time
- Personalized insights and recommendations

## 🔧 API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `POST /auth/logout` - User logout

### Journal
- `POST /journal/add_entry` - Create journal entry
- `GET /journal/get_entries` - Get user entries
- `GET /journal/get_entry/<id>` - Get specific entry
- `PUT /journal/update_entry/<id>` - Update entry
- `DELETE /journal/entry/<id>` - Delete entry
- `GET /journal/search_entries` - Search entries

### Analytics
- `GET /analytics/trends` - Get sentiment trends
- `GET /analytics/insights` - Get personalized insights
- `GET /analytics/summary` - Get period summary
- `GET /analytics/export_data` - Export all data

## 📱 Pages Overview

- **Home (index.html)**: Landing page with overview
- **Login (login.html)**: User authentication
- **Signup (signup.html)**: User registration
- **Dashboard (dashboard.html)**: Main user interface
- **Journal (journal.html)**: Journal entry management
- **Analytics (analytics.html)**: Data visualization
- **Profile (profile.html)**: User profile management
- **Settings**: Application configuration

## 🚀 Getting Started

### Quick Start (Full Stack)
1. **Start the Backend**:
   ```bash
   cd backend
   python app.py
   ```
   Backend runs on `http://localhost:5000`

2. **Open the Frontend**:
   - Open `frontend/pages/index.html` in your browser
   - Or use the startup script: `start.bat`

3. **Create an Account**:
   - Navigate to the signup page
   - Create your account
   - Start tracking your mental health

### Frontend-Backend Connection
- ✅ **Authentication**: Login/Signup with JWT tokens
- ✅ **Journal Entries**: Create, read, delete entries with AI sentiment analysis
- ✅ **Analytics**: Real-time dashboard with mood trends and insights
- ✅ **Data Persistence**: All data stored in PostgreSQL database
- ✅ **Security**: Protected routes and API endpoints

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: Bcrypt encryption
- **Rate Limiting**: API protection
- **CORS Configuration**: Secure cross-origin requests
- **Input Validation**: Sanitized user inputs

## 📈 Features

- **Real-time Sentiment Analysis**: AI-powered emotional state detection
- **Mood Tracking**: Visual mood indicators and trends
- **Journal Management**: Create, edit, and organize entries
- **Analytics Dashboard**: Comprehensive insights and patterns
- **Search & Filter**: Find specific entries quickly
- **Data Export**: Download your mental health data
- **Responsive Design**: Works on all devices

## 🏆 Project Highlights

- **Full-Stack Implementation**: Complete backend and frontend
- **AI/ML Integration**: Custom sentiment analysis model
- **Modern Design**: Clean, responsive interface
- **Comprehensive Features**: Complete mental health tracking solution
- **Production Ready**: Secure and scalable architecture

## 👨‍💻 Developer

**Arun** - Full-Stack Developer & AI Engineer

---

*Built with ❤️ for mental health awareness and support*