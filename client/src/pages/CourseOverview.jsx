import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { coursesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import '../styles/course_overview.css';

export default function CourseOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);
  const [completedSubs, setCompletedSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coursesApi.get(id)
      .then((data) => setCourse(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Load progress for logged-in users
  useEffect(() => {
    if (user && id) {
      coursesApi.getProgress(id)
        .then((data) => {
          if (data?.completedSubs) setCompletedSubs(data.completedSubs);
        })
        .catch(() => {});
    }
  }, [user, id]);

  const handleToggleTopic = (idx) => {
    setActiveTopic(activeTopic === idx ? null : idx);
  };

  const isSubCompleted = (topicIdx, subIdx) => {
    return completedSubs.includes(`${topicIdx}-${subIdx}`);
  };

  const isTopicCompleted = (topicIdx, subsections) => {
    if (!subsections || subsections.length === 0) return false;
    return subsections.every((_, sIdx) => isSubCompleted(topicIdx, sIdx));
  };

  const handleToggleSubComplete = async (topicIdx, subIdx, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    const subKey = `${topicIdx}-${subIdx}`;
    const isComplete = completedSubs.includes(subKey);
    const newComplete = !isComplete;

    // Optimistic update
    setCompletedSubs((prev) =>
      newComplete ? [...prev, subKey] : prev.filter((k) => k !== subKey)
    );

    try {
      await coursesApi.updateProgress(id, subKey, newComplete);
    } catch {
      // Revert on failure
      setCompletedSubs((prev) =>
        newComplete ? prev.filter((k) => k !== subKey) : [...prev, subKey]
      );
    }
  };

  if (loading) return <section className="course-hero"><div className="section-container"><p>Loading…</p></div></section>;
  if (!course) return <section className="course-hero"><div className="section-container"><p>Course not found.</p></div></section>;

  const topics = course.topics || course.sections || [];

  return (
    <>
      <SEO
        title={`${course.title} — LoopBridge Academy`}
        description={course.description || 'View course details, curriculum, and enroll in LoopBridge Academy courses.'}
        image={course.image}
      />

      <section className="course-hero">
        <div className="section-container">
          <Link to="/courses" className="back-to-courses">
            <i className="fa-solid fa-angle-left" />
            <span>Back to all courses</span>
          </Link>
          <div className="banner">
            <div className="body">
              <h1>{course.title}</h1>
              <p>{course.description}</p>
              <button className="course-enroll-btn btn-primary hero-btn" onClick={() => {
                const topics = course.topics || [];
                if (topics.length > 0 && topics[0].subtopics?.length > 0) {
                  navigate(`/courses/${id}/lesson/0/0`);
                }
              }}>Start Course</button>
              <div className="metadata">
                {course.author && (
                  <div className="author">
                    <i className="fa-solid fa-user" />
                    <p>{course.author?.name || (typeof course.author === 'string' ? course.author : 'LoopBridge Team')}</p>
                  </div>
                )}
                {course.duration && (
                  <div className="duration">
                    <i className="fa-solid fa-clock" />
                    <p>{course.duration}</p>
                  </div>
                )}
                <div className="difficulty">
                  <i className="fa-solid fa-signal" />
                  <p>{course.level ? `${course.level.charAt(0).toUpperCase() + course.level.slice(1)} Level` : 'Beginner Level'}</p>
                </div>
              </div>
            </div>
            <div className="right vector">
              <img src="/images/right-vector.svg" alt="Vector Pattern" />
            </div>
          </div>
        </div>
      </section>

      <section className="course-body">
        <div className="section-container">
          {course.overview && (
            <>
              <h2>Overview</h2>
              <p>{course.overview}</p>
            </>
          )}

          {(course.learningOutcomes || course.learningObjectives)?.length > 0 && (
            <>
              <h2>What you'll learn</h2>
              <ul>
                {(course.learningOutcomes || course.learningObjectives).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {topics.length > 0 && (
            <>
              <hr />
              <h2>Syllabus</h2>
              <div className="topics">
                {topics.map((topic, idx) => {
                  const subs = topic.subsections || [];
                  const topicDone = isTopicCompleted(idx, subs);
                  return (
                    <div className={`topic${activeTopic === idx ? ' active' : ''}`} key={idx}>
                      <div className="topic-bar" onClick={() => handleToggleTopic(idx)} role="button" tabIndex={0}>
                        <div className="title-section">
                          <div className={`checkmark${topicDone ? ' completed' : ''}`}>
                            <i className="fa-solid fa-circle-check" />
                          </div>
                          <div className="topic-name">
                            <span className="topic-number">{idx + 1}</span>.{' '}
                            {topic.title}
                          </div>
                        </div>
                        <div className="topic-metadata">
                          {topic.videos !== undefined && (
                            <div className="videos">
                              <i className="fa-solid fa-video" />
                              {topic.videos || subs.length} Videos
                            </div>
                          )}
                          {topic.quizzes !== undefined && (
                            <div className="quizzes">
                              <i className="fa-solid fa-clipboard-list" />
                              {topic.quizzes} Quizzes
                            </div>
                          )}
                        </div>
                        <div className="topic-dropdown-btn">
                          <i className="fa-solid fa-angle-down" />
                        </div>
                      </div>
                      <div className="dropdown-section">
                        {subs.map((sub, sIdx) => {
                          const subDone = isSubCompleted(idx, sIdx);
                          return (
                            <div className="subsection" key={sIdx}>
                              <button
                                className={`complete-btn${subDone ? ' completed' : ''}`}
                                onClick={(e) => handleToggleSubComplete(idx, sIdx, e)}
                                title={subDone ? 'Mark incomplete' : 'Mark complete'}
                              >
                                <i className="fa-solid fa-circle-check" />
                              </button>
                              <div className="subsection-title">{sub.title}</div>
                              <div className="subsection-duration">{sub.duration || '5 mins'}</div>
                              <Link to={`/courses/${id}/lessons/${idx}/${sIdx}`} className="subsection-link">
                                <button className="learn-btn">
                                  <i className={`fa-solid ${sub.type === 'quiz' ? 'fa-clipboard-list' : sub.type === 'reading' ? 'fa-book-open' : 'fa-circle-play'}`} /> {sub.type === 'quiz' ? 'Quiz' : 'Learn'}
                                </button>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
