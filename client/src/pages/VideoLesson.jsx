import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import AdaptiveVideoPlayer from '../components/AdaptiveVideoPlayer';
import { coursesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../hooks/useAnalytics';
import '../styles/lesson.css';
import '../styles/adaptive-player.css';

/**
 * VideoLesson — plays a video with optional inline quiz pause-points.
 *
 * URL: /courses/:courseId/lessons/:topicIdx/:subIdx
 *
 * Data shape from course.topics[topicIdx].subsections[subIdx]:
 *   { title, type: "video", duration, videoUrl?,
 *     quizPoints?: [{ atSeconds: 120, questions: [...] }],
 *     content?: [ { type: "text"|"heading"|"image"|"code"|"note", value } ]
 *   }
 *
 * The quiz pause-points pause the video and show a quiz overlay.
 * The user must pass (≥70%) to continue. On fail, they can retry.
 */
export default function VideoLesson() {
  const { courseId, topicIdx, subIdx } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Quiz state
  const [activeQuiz, setActiveQuiz] = useState(null); // { questions, atSeconds, pointIdx }
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null); // { score, passed }
  const [shuffledMaps, setShuffledMaps] = useState({}); // { [qIdx]: number[] } — shuffled original-indices
  const [endShuffledMaps, setEndShuffledMaps] = useState({});
  const [completedQuizPoints, setCompletedQuizPoints] = useState(new Set());
  const [showEndQuiz, setShowEndQuiz] = useState(false);
  const [endQuizAnswers, setEndQuizAnswers] = useState({});
  const [endQuizResult, setEndQuizResult] = useState(null);
  const [lessonComplete, setLessonComplete] = useState(false);

  const videoRef = useRef(null);

  /** Fisher-Yates shuffle — returns an array of original indices in new display order */
  const buildShuffleMaps = (questions) => {
    const maps = {};
    questions.forEach((q, i) => {
      const indices = q.options.map((_, j) => j);
      for (let k = indices.length - 1; k > 0; k--) {
        const r = Math.floor(Math.random() * (k + 1));
        [indices[k], indices[r]] = [indices[r], indices[k]];
      }
      maps[i] = indices;
    });
    return maps;
  };

  useEffect(() => {
    setLoading(true);
    setAccessDenied(false);
    coursesApi.get(courseId)
      .then((c) => {
        setCourse(c);
        // Only check access for paid courses (price > 0)
        if (c.price > 0) {
          return coursesApi.checkAccess(courseId)
            .then(({ canAccess }) => { if (!canAccess) setAccessDenied(true); })
            .catch((err) => {
              // 401 = not logged in, 403 = no access — either way, block
              if (err.status === 401 || err.status === 403) setAccessDenied(true);
            });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  // Redirect when access is denied (payment required)
  useEffect(() => {
    if (accessDenied) {
      navigate(`/courses/${courseId}`, { replace: true, state: { paymentRequired: true } });
    }
  }, [accessDenied, courseId, navigate]);

  // Reset all quiz/lesson state when navigating between lessons
  useEffect(() => {
    setActiveQuiz(null);
    setAnswers({});
    setQuizResult(null);
    setCompletedQuizPoints(new Set());
    setShowEndQuiz(false);
    setEndQuizAnswers({});
    setEndQuizResult(null);
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
  const quizPoints = sub?.quizPoints || [];

  // Track lesson start
  useEffect(() => {
    if (sub) {
      trackEvent('lesson_start', {
        courseId,
        metadata: { topicIdx, subIdx, title: sub.title, type: 'video' },
        userId: user?.id,
      });
    }
  }, [courseId, topicIdx, subIdx, sub?.title]); // eslint-disable-line

  // Quiz pause-point monitoring is handled by the onTimeUpdate prop on AdaptiveVideoPlayer

  const handleAnswer = (qIdx, optionIdx) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz) return;
    const { questions, pointIdx } = activeQuiz;
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === (q.correctIndex ?? q.correct)) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= 70;

    setQuizResult({ score, passed, correct, total: questions.length });
    trackEvent('quiz_submit', {
      courseId,
      quizId: `${courseId}-${topicIdx}-${subIdx}-qp${pointIdx}`,
      score,
      userId: user?.id,
      metadata: { passed, correct, total: questions.length },
    });

    if (passed) {
      setCompletedQuizPoints((prev) => new Set([...prev, pointIdx]));
    }
  };

  const handleRetryQuiz = () => {
    setAnswers({});
    setQuizResult(null);
    if (activeQuiz) setShuffledMaps(buildShuffleMaps(activeQuiz.questions));
    trackEvent('quiz_retry', {
      courseId,
      quizId: `${courseId}-${topicIdx}-${subIdx}-qp${activeQuiz?.pointIdx}`,
      userId: user?.id,
    });
  };

  const handleContinueAfterQuiz = () => {
    setActiveQuiz(null);
    setQuizResult(null);
    setAnswers({});
    setShuffledMaps({});
    videoRef.current?.play();
  };

  /* ── end-of-lesson quiz handlers ── */
  const handleEndQuizAnswer = (qIdx, optionIdx) => {
    setEndQuizAnswers(prev => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleSubmitEndQuiz = () => {
    const questions = sub?.endQuiz || [];
    let correct = 0;
    questions.forEach((q, i) => {
      if (endQuizAnswers[i] === (q.correctIndex ?? q.correct)) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= 70;

    setEndQuizResult({ score, passed, correct, total: questions.length });
    trackEvent('quiz_submit', {
      courseId,
      quizId: `${courseId}-${topicIdx}-${subIdx}-endquiz`,
      score,
      userId: user?.id,
      metadata: { passed, correct, total: questions.length },
    });

    if (passed) {
      setLessonComplete(true);
      if (user) {
        coursesApi.updateProgress(courseId, `${topicIdx}-${subIdx}`, true).catch(() => {});
      }
    }
  };

  const handleRetryEndQuiz = () => {
    setEndQuizAnswers({});
    setEndQuizResult(null);
    if (sub?.endQuiz) setEndShuffledMaps(buildShuffleMaps(sub.endQuiz));
  };

  const handleVideoEnd = () => {
    trackEvent('lesson_complete', {
      courseId,
      metadata: { topicIdx, subIdx, title: sub?.title, type: 'video' },
      userId: user?.id,
    });

    // If there's an end-of-lesson quiz, show it instead of auto-completing
    const endQuiz = sub?.endQuiz || [];
    if (endQuiz.length > 0 && !lessonComplete) {
      setShowEndQuiz(true);
      setEndShuffledMaps(buildShuffleMaps(endQuiz));
      return;
    }

    // No quiz — mark progress
    if (user && sub && !lessonComplete) {
      setLessonComplete(true);
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

  if (accessDenied) return null; // useEffect below handles redirect

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
        description={`Watch: ${sub.title}`}
      />

      <section className="lesson-section">
        {/* Back button */}
        <div className="section-container">
          <Link to={`/courses/${courseId}`} className="lesson-back">
            <i className="fa-solid fa-angle-left" /> {course.title}
          </Link>
        </div>

        <div className="lesson-container">
          {/* Video player */}
          <div className="video-quiz-container">
              {(sub.hlsUrl || sub.videoUrl) ? (
                <AdaptiveVideoPlayer
                  ref={videoRef}
                  src={sub.hlsUrl || sub.videoUrl}
                  poster={sub.thumbnailUrl}
                  onEnded={handleVideoEnd}
                  onTimeUpdate={(currentTime) => {
                    // Quiz pause-point monitoring
                    for (let i = 0; i < quizPoints.length; i++) {
                      const point = quizPoints[i];
                      if (
                        !completedQuizPoints.has(i) &&
                        currentTime >= point.atSeconds &&
                        currentTime < point.atSeconds + 1.5
                      ) {
                        if (videoRef.current) videoRef.current.pause();
                        setActiveQuiz({ ...point, pointIdx: i });
                        setAnswers({});
                        setQuizResult(null);
                        setShuffledMaps(buildShuffleMaps(point.questions));
                        trackEvent('quiz_start', {
                          courseId,
                          quizId: `${courseId}-${topicIdx}-${subIdx}-qp${i}`,
                          userId: user?.id,
                        });
                        break;
                      }
                    }
                  }}
                  className="lesson-video"
                  quizOverlay={activeQuiz ? (
                    <div className="quiz-overlay">
                      <div className="quiz-card">
                        <div className="quiz-header">
                          <i className="fa-solid fa-clipboard-list" />
                          <h3>Quick Check</h3>
                          <p>Answer correctly to continue (70% to pass)</p>
                        </div>

                        {!quizResult ? (
                          <div className="quiz-body">
                            {activeQuiz.questions.map((q, qIdx) => {
                              const order = shuffledMaps[qIdx] || q.options.map((_, i) => i);
                              return (
                                <div className="quiz-question" key={qIdx}>
                                  <p className="question-text">{qIdx + 1}. {q.question}</p>
                                  <div className="question-options">
                                    {order.map((origIdx, displayIdx) => (
                                      <button
                                        key={origIdx}
                                        className={`option-btn${answers[qIdx] === origIdx ? ' selected' : ''}`}
                                        onClick={() => handleAnswer(qIdx, origIdx)}
                                      >
                                        <span className="option-letter">{String.fromCharCode(65 + displayIdx)}</span>
                                        {q.options[origIdx]}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            <button
                              className="quiz-submit-btn"
                              onClick={handleSubmitQuiz}
                              disabled={Object.keys(answers).length < activeQuiz.questions.length}
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
                                ? `Great job! You got ${quizResult.correct}/${quizResult.total} correct.`
                                : `You got ${quizResult.correct}/${quizResult.total}. You need 70% to continue.`}
                            </p>
                            {/* Per-option explanations */}
                            {activeQuiz.questions.some(q => q.optionExplanations?.some(Boolean)) && (
                              <div className="quiz-explanations">
                                {activeQuiz.questions.map((q, qIdx) => (
                                  <div className="explanation-block" key={qIdx}>
                                    <p className="explanation-question">{qIdx + 1}. {q.question}</p>
                                    {q.options.map((opt, origIdx) => {
                                      const isCorrect = origIdx === (q.correctIndex ?? q.correct);
                                      const isSelected = answers[qIdx] === origIdx;
                                      const expl = q.optionExplanations?.[origIdx];
                                      return (
                                        <div
                                          key={origIdx}
                                          className={`explanation-option${isCorrect ? ' expl-correct' : ''}${isSelected && !isCorrect ? ' expl-wrong' : ''}`}
                                        >
                                          <span className="expl-indicator">
                                            <i className={`fa-solid ${isCorrect ? 'fa-check' : isSelected ? 'fa-xmark' : 'fa-minus'}`} />
                                          </span>
                                          <span className="expl-text">
                                            <strong>{opt}</strong>
                                            {expl && <span className="expl-detail"> — {expl}</span>}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            )}
                            {quizResult.passed ? (
                              <button className="quiz-continue-btn" onClick={handleContinueAfterQuiz}>
                                Continue Video <i className="fa-solid fa-arrow-right" />
                              </button>
                            ) : (
                              <button className="quiz-retry-btn" onClick={handleRetryQuiz}>
                                <i className="fa-solid fa-rotate-left" /> Try Again
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                />
              ) : (
                <div className="video-placeholder">
                  <i className="fa-solid fa-video" />
                  <p>Video coming soon</p>
                  <p className="placeholder-sub">This lesson's video content is being prepared.</p>
                </div>
              )}
          </div>

          {/* Lesson info */}
          <div className="lesson-info">
            <h1 className="lesson-title">{sub.title}</h1>
            <div className="lesson-meta">
              {sub.duration && <span><i className="fa-solid fa-clock" /> {sub.duration}</span>}
              <span><i className="fa-solid fa-signal" /> {topic.title}</span>
              {sub.type && <span className="lesson-type-badge video-badge"><i className="fa-solid fa-video" /> Video</span>}
            </div>
          </div>

          {/* Supplementary text/content below the video */}
          {sub.content && sub.content.length > 0 && (
            <div className="lesson-content">
              <h2>Lesson Notes</h2>
              {sub.content.map((block, i) => {
                switch (block.type) {
                  case 'heading':
                    return <h3 key={i}>{block.value}</h3>;
                  case 'text':
                    return <p key={i}>{block.value}</p>;
                  case 'image':
                    return <img key={i} src={block.value} alt={block.alt || ''} className="lesson-content-img" />;
                  case 'code':
                    return <pre key={i} className="lesson-code"><code>{block.value}</code></pre>;
                  case 'note':
                    return (
                      <div key={i} className="lesson-note">
                        <i className="fa-solid fa-lightbulb" />
                        <p>{block.value}</p>
                      </div>
                    );
                  case 'list':
                    return (
                      <ul key={i} className="lesson-list">
                        {block.value.split('\n').filter(Boolean).map((item, li) => (
                          <li key={li}>{item}</li>
                        ))}
                      </ul>
                    );
                  default:
                    return <p key={i}>{block.value}</p>;
                }
              })}
            </div>
          )}

          {/* ── End-of-lesson quiz ── */}
          {showEndQuiz && (sub.endQuiz || []).length > 0 && (
            <div className="end-quiz-section">
              <div className="quiz-card inline-quiz">
                <div className="quiz-header">
                  <i className="fa-solid fa-clipboard-list" />
                  <h3>Lesson Quiz</h3>
                  <p>Score at least 70% to mark this lesson complete</p>
                </div>

                {!endQuizResult ? (
                  <div className="quiz-body">
                    {sub.endQuiz.map((q, qIdx) => {
                      const order = endShuffledMaps[qIdx] || q.options.map((_, i) => i);
                      return (
                        <div className="quiz-question" key={qIdx}>
                          <p className="question-text">{qIdx + 1}. {q.question}</p>
                          <div className="question-options">
                            {order.map((origIdx, displayIdx) => (
                              <button
                                key={origIdx}
                                className={`option-btn${endQuizAnswers[qIdx] === origIdx ? ' selected' : ''}`}
                                onClick={() => handleEndQuizAnswer(qIdx, origIdx)}
                              >
                                <span className="option-letter">{String.fromCharCode(65 + displayIdx)}</span>
                                {q.options[origIdx]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <button
                      className="quiz-submit-btn"
                      onClick={handleSubmitEndQuiz}
                      disabled={Object.keys(endQuizAnswers).length < sub.endQuiz.length}
                    >
                      Submit Answers
                    </button>
                  </div>
                ) : (
                  <div className="quiz-result">
                    <div className={`result-badge ${endQuizResult.passed ? 'passed' : 'failed'}`}>
                      <i className={`fa-solid ${endQuizResult.passed ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                      <span>{endQuizResult.score}%</span>
                    </div>
                    <p className="result-text">
                      {endQuizResult.passed
                        ? `Great job! You got ${endQuizResult.correct}/${endQuizResult.total} correct.`
                        : `You got ${endQuizResult.correct}/${endQuizResult.total}. You need 70% to continue.`}
                    </p>
                    {/* Per-option explanations */}
                    {sub.endQuiz.some(q => q.optionExplanations?.some(Boolean)) && (
                      <div className="quiz-explanations">
                        {sub.endQuiz.map((q, qIdx) => (
                          <div className="explanation-block" key={qIdx}>
                            <p className="explanation-question">{qIdx + 1}. {q.question}</p>
                            {q.options.map((opt, origIdx) => {
                              const isCorrect = origIdx === (q.correctIndex ?? q.correct);
                              const isSelected = endQuizAnswers[qIdx] === origIdx;
                              const expl = q.optionExplanations?.[origIdx];
                              return (
                                <div
                                  key={origIdx}
                                  className={`explanation-option${isCorrect ? ' expl-correct' : ''}${isSelected && !isCorrect ? ' expl-wrong' : ''}`}
                                >
                                  <span className="expl-indicator">
                                    <i className={`fa-solid ${isCorrect ? 'fa-check' : isSelected ? 'fa-xmark' : 'fa-minus'}`} />
                                  </span>
                                  <span className="expl-text">
                                    <strong>{opt}</strong>
                                    {expl && <span className="expl-detail"> — {expl}</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                    {!endQuizResult.passed && (
                      <button className="quiz-retry-btn" onClick={handleRetryEndQuiz}>
                        <i className="fa-solid fa-rotate-left" /> Try Again
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lesson complete badge */}
          {lessonComplete && (
            <div className="lesson-complete-badge">
              <i className="fa-solid fa-circle-check" /> Lesson complete!
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
