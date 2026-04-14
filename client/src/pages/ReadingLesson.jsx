import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { coursesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../hooks/useAnalytics';
import '../styles/lesson.css';

/**
 * ReadingLesson — article-style reading content with a quiz at the end.
 *
 * URL: /courses/:courseId/lessons/:topicIdx/:subIdx
 *
 * Data shape from course.topics[topicIdx].subsections[subIdx]:
 *   { title, type: "reading", duration,
 *     content: [ { type: "heading"|"text"|"image"|"code"|"note"|"list", value, items? } ],
 *     quiz?: { questions: [{ question, options, correctIndex }] }
 *   }
 *
 * The quiz appears at the end. User must score ≥70% to mark the lesson complete.
 */
export default function ReadingLesson() {
  const { courseId, topicIdx, subIdx } = useParams();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [lessonComplete, setLessonComplete] = useState(false);

  // Reading progress
  const [readingStartedAt] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    coursesApi.get(courseId)
      .then(setCourse)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  // Reset quiz/lesson state when navigating between lessons
  useEffect(() => {
    setShowQuiz(false);
    setAnswers({});
    setQuizResult(null);
    setLessonComplete(false);

    // Check if this lesson was already completed
    if (user) {
      coursesApi.getProgress(courseId)
        .then((data) => {
          if (data?.completedSubs?.includes(`${topicIdx}-${subIdx}`)) {
            setLessonComplete(true);
          }
        })
        .catch(() => {});
    }
  }, [courseId, topicIdx, subIdx]); // eslint-disable-line

  const topic = course?.topics?.[Number(topicIdx)];
  const sub = topic?.subsections?.[Number(subIdx)];
  // Support both old { quiz: { questions: [...] } } and new { endQuiz: [...] } shapes
  const quizQuestions = sub?.endQuiz?.length ? sub.endQuiz : sub?.quiz?.questions || [];
  const content = sub?.content || [];

  // Track lesson start
  useEffect(() => {
    if (sub) {
      trackEvent('lesson_start', {
        courseId,
        metadata: { topicIdx, subIdx, title: sub.title, type: 'reading' },
        userId: user?.id,
      });
    }
  }, [courseId, topicIdx, subIdx, sub?.title]); // eslint-disable-line

  const handleAnswer = (qIdx, optionIdx) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleSubmitQuiz = () => {
    if (!quizQuestions.length) return;
    let correct = 0;
    quizQuestions.forEach((q, i) => {
      const rightIdx = q.correctIndex ?? q.correct;
      if (answers[i] === rightIdx) correct++;
    });
    const score = Math.round((correct / quizQuestions.length) * 100);
    const passed = score >= 70;

    setQuizResult({ score, passed, correct, total: quizQuestions.length });
    trackEvent('quiz_submit', {
      courseId,
      quizId: `${courseId}-${topicIdx}-${subIdx}-endquiz`,
      score,
      userId: user?.id,
      metadata: { passed, correct, total: questions.length },
    });

    if (passed) {
      setLessonComplete(true);
      trackEvent('lesson_complete', {
        courseId,
        metadata: {
          topicIdx, subIdx, title: sub?.title, type: 'reading',
          readingDurationMs: Date.now() - readingStartedAt,
        },
        userId: user?.id,
      });
      if (user) {
        coursesApi.updateProgress(courseId, `${topicIdx}-${subIdx}`, true).catch(() => {});
      }
    }
  };

  const handleRetryQuiz = () => {
    setAnswers({});
    setQuizResult(null);
    trackEvent('quiz_retry', {
      courseId,
      quizId: `${courseId}-${topicIdx}-${subIdx}-endquiz`,
      userId: user?.id,
    });
  };

  const handleMarkComplete = () => {
    setLessonComplete(true);
    trackEvent('lesson_complete', {
      courseId,
      metadata: {
        topicIdx, subIdx, title: sub?.title, type: 'reading',
        readingDurationMs: Date.now() - readingStartedAt,
      },
      userId: user?.id,
    });
    if (user) {
      coursesApi.updateProgress(courseId, `${topicIdx}-${subIdx}`, true).catch(() => {});
    }
  };

  // Navigation helpers
  const totalSubs = topic?.subsections?.length || 0;
  const currentSubIdx = Number(subIdx);
  const currentTopicIdx = Number(topicIdx);
  const totalTopics = course?.topics?.length || 0;

  const getNextLesson = useCallback(() => {
    if (currentSubIdx + 1 < totalSubs) {
      return `/courses/${courseId}/lessons/${currentTopicIdx}/${currentSubIdx + 1}`;
    }
    if (currentTopicIdx + 1 < totalTopics) {
      return `/courses/${courseId}/lessons/${currentTopicIdx + 1}/0`;
    }
    return null;
  }, [courseId, currentSubIdx, currentTopicIdx, totalSubs, totalTopics]);

  const getPrevLesson = useCallback(() => {
    if (currentSubIdx > 0) {
      return `/courses/${courseId}/lessons/${currentTopicIdx}/${currentSubIdx - 1}`;
    }
    if (currentTopicIdx > 0) {
      const prevTopic = course?.topics?.[currentTopicIdx - 1];
      const prevSubCount = prevTopic?.subsections?.length || 1;
      return `/courses/${courseId}/lessons/${currentTopicIdx - 1}/${prevSubCount - 1}`;
    }
    return null;
  }, [course, courseId, currentSubIdx, currentTopicIdx]);

  if (loading) {
    return (
      <section className="lesson-section">
        <div className="section-container"><p className="lesson-loading">Loading lesson…</p></div>
      </section>
    );
  }

  if (!course || !topic || !sub) {
    return (
      <section className="lesson-section">
        <div className="section-container">
          <p className="lesson-error">Lesson not found.</p>
          <Link to={`/courses/${courseId}`} className="lesson-back">
            <i className="fa-solid fa-angle-left" /> Back to course
          </Link>
        </div>
      </section>
    );
  }

  const prevUrl = getPrevLesson();
  const nextUrl = getNextLesson();

  return (
    <>
      <SEO
        title={`${sub.title} — ${course.title} — LoopBridge Academy`}
        description={`Read: ${sub.title}`}
      />

      <section className="lesson-section reading-lesson">
        {/* Back button */}
        <div className="section-container">
          <Link to={`/courses/${courseId}`} className="lesson-back">
            <i className="fa-solid fa-angle-left" /> {course.title}
          </Link>
        </div>

        <div className="lesson-container">
          {/* Lesson header */}
          <div className="lesson-info">
            <h1 className="lesson-title">{sub.title}</h1>
            <div className="lesson-meta">
              {sub.duration && <span><i className="fa-solid fa-clock" /> {sub.duration}</span>}
              <span><i className="fa-solid fa-signal" /> {topic.title}</span>
              <span className="lesson-type-badge reading-badge"><i className="fa-solid fa-book-open" /> Reading</span>
            </div>
          </div>

          {/* Reading content */}
          <article className="lesson-content reading-content">
            {content.length > 0 ? (
              content.map((block, i) => {
                switch (block.type) {
                  case 'heading':
                    return <h2 key={i}>{block.value}</h2>;
                  case 'subheading':
                    return <h3 key={i}>{block.value}</h3>;
                  case 'text':
                    return <p key={i}>{block.value}</p>;
                  case 'image':
                    return (
                      <figure key={i} className="lesson-figure">
                        <img src={block.value} alt={block.alt || block.caption || ''} className="lesson-content-img" />
                        {block.caption && <figcaption>{block.caption}</figcaption>}
                      </figure>
                    );
                  case 'code':
                    return <pre key={i} className="lesson-code"><code>{block.value}</code></pre>;
                  case 'note':
                    return (
                      <div key={i} className="lesson-note">
                        <i className="fa-solid fa-lightbulb" />
                        <p>{block.value}</p>
                      </div>
                    );
                  case 'warning':
                    return (
                      <div key={i} className="lesson-warning">
                        <i className="fa-solid fa-triangle-exclamation" />
                        <p>{block.value}</p>
                      </div>
                    );
                  case 'list':
                    return (
                      <ul key={i} className="lesson-list">
                        {(block.items || []).map((item, j) => <li key={j}>{item}</li>)}
                      </ul>
                    );
                  case 'ordered-list':
                    return (
                      <ol key={i} className="lesson-list">
                        {(block.items || []).map((item, j) => <li key={j}>{item}</li>)}
                      </ol>
                    );
                  case 'divider':
                    return <hr key={i} className="lesson-divider" />;
                  default:
                    return <p key={i}>{block.value}</p>;
                }
              })
            ) : (
              <div className="reading-placeholder">
                <i className="fa-solid fa-book-open" />
                <p>Reading content is being prepared for this lesson.</p>
              </div>
            )}
          </article>

          {/* End-of-lesson quiz */}
          {quizQuestions.length > 0 && (
            <div className="end-quiz-section">
              {!showQuiz && !lessonComplete && (
                <button className="start-quiz-btn" onClick={() => {
                  setShowQuiz(true);
                  trackEvent('quiz_start', {
                    courseId,
                    quizId: `${courseId}-${topicIdx}-${subIdx}-endquiz`,
                    userId: user?.id,
                  });
                }}>
                  <i className="fa-solid fa-clipboard-list" /> Take the Quiz to Complete This Lesson
                </button>
              )}

              {showQuiz && !lessonComplete && (
                <div className="quiz-card inline-quiz">
                  <div className="quiz-header">
                    <i className="fa-solid fa-clipboard-list" />
                    <h3>Lesson Quiz</h3>
                    <p>Score 70% or higher to complete this lesson</p>
                  </div>

                  {!quizResult ? (
                    <div className="quiz-body">
                      {quizQuestions.map((q, qIdx) => (
                        <div className="quiz-question" key={qIdx}>
                          <p className="question-text">{qIdx + 1}. {q.question}</p>
                          <div className="question-options">
                            {q.options.map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                className={`option-btn${answers[qIdx] === oIdx ? ' selected' : ''}`}
                                onClick={() => handleAnswer(qIdx, oIdx)}
                              >
                                <span className="option-letter">{String.fromCharCode(65 + oIdx)}</span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        className="quiz-submit-btn"
                        onClick={handleSubmitQuiz}
                        disabled={Object.keys(answers).length < quizQuestions.length}
                      >
                        Submit Answers
                      </button>
                    </div>
                  ) : (
                    <div className="quiz-result">
                      <div className={`result-badge ${quizResult.passed ? 'passed' : 'failed'}`}>
                        <i className={`fa-solid ${quizResult.passed ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                        <span>{quizResult.score}%</span>
                      </div>
                      <p className="result-text">
                        {quizResult.passed
                          ? `Excellent! You scored ${quizResult.correct}/${quizResult.total}. Lesson complete!`
                          : `You scored ${quizResult.correct}/${quizResult.total}. You need 70% to pass.`}
                      </p>
                      {!quizResult.passed && (
                        <button className="quiz-retry-btn" onClick={handleRetryQuiz}>
                          <i className="fa-solid fa-rotate-left" /> Try Again
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {lessonComplete && (
                <div className="lesson-complete-badge">
                  <i className="fa-solid fa-circle-check" />
                  <span>Lesson Complete</span>
                </div>
              )}
            </div>
          )}

          {/* No quiz: show mark-complete button */}
          {quizQuestions.length === 0 && !lessonComplete && (
            <div className="end-quiz-section">
              <button className="start-quiz-btn complete-btn" onClick={handleMarkComplete}>
                <i className="fa-solid fa-circle-check" /> Mark as Complete
              </button>
            </div>
          )}

          {quizQuestions.length === 0 && lessonComplete && (
            <div className="end-quiz-section">
              <div className="lesson-complete-badge">
                <i className="fa-solid fa-circle-check" />
                <span>Lesson Complete</span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="lesson-nav">
            {prevUrl ? (
              <Link to={prevUrl} className="lesson-nav-btn prev">
                <i className="fa-solid fa-arrow-left" /> Previous Lesson
              </Link>
            ) : <div />}
            {nextUrl ? (
              <Link to={nextUrl} className="lesson-nav-btn next">
                Next Lesson <i className="fa-solid fa-arrow-right" />
              </Link>
            ) : (
              <Link to={`/courses/${courseId}`} className="lesson-nav-btn next complete">
                Back to Course <i className="fa-solid fa-flag-checkered" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
