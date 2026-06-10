import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import CourseCard from '../components/CourseCard';
import { coursesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import '../styles/learning_track.css';
import '../styles/my-learning.css';

export default function MyLearning() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    coursesApi.listEnrolled()
      .then((data) => setItems(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <section className="my-learning-hero">
        <div className="section-container">
          <h1>My Learning</h1>
          <p>Log in to track your course progress and pick up where you left off.</p>
          <Link to="/login" className="btn btn-primary">Log In</Link>
        </div>
      </section>
    );
  }

  const inProgress = items.filter((item) => item.progressPct < 100);
  const completed = items.filter((item) => item.progressPct >= 100);
  const lessonsDone = items.reduce((sum, item) => sum + item.completedCount, 0);

  return (
    <>
      <SEO
        title="My Learning — LoopBridge"
        description="Track your course progress and continue learning at your own pace."
      />

      <section className="my-learning-hero">
        <div className="section-container">
          <h1>My Learning</h1>
          <p>Welcome back, {user.displayName || user.username}. Pick up right where you left off.</p>

          <div className="learning-stats">
            <div className="stat-card">
              <div className="stat-value">{items.length}</div>
              <div className="stat-label">Enrolled Courses</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{inProgress.length}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{completed.length}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{lessonsDone}</div>
              <div className="stat-label">Lessons Done</div>
            </div>
          </div>
        </div>
      </section>

      <section className="my-learning-section">
        <div className="section-container">
          {loading ? (
            <div className="my-learning-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-image" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="my-learning-empty">
              <i className="fa-solid fa-graduation-cap" />
              <h2>You haven't started a course yet</h2>
              <p>Browse the academy and enroll in a course to start tracking your progress here.</p>
              <Link to="/courses" className="btn btn-primary">Browse Courses</Link>
            </div>
          ) : (
            <>
              {inProgress.length > 0 && (
                <>
                  <h2>Continue Learning</h2>
                  <div className="my-learning-grid">
                    {inProgress.map((item) => (
                      <CourseCard key={item.course.id} course={item.course} progress={item} />
                    ))}
                  </div>
                </>
              )}

              {completed.length > 0 && (
                <>
                  <h2>Completed</h2>
                  <div className="my-learning-grid">
                    {completed.map((item) => (
                      <CourseCard key={item.course.id} course={item.course} progress={item} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
