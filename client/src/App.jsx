import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Academy from './pages/Academy';
import Articles from './pages/Articles';
import Blog from './pages/Blog';
import Community from './pages/Community';
import Courses from './pages/Courses';
import CourseOverview from './pages/CourseOverview';
import Exchange from './pages/Exchange';
import Faqs from './pages/Faqs';
import LearningTrack from './pages/LearningTrack';
import LessonRouter from './pages/LessonRouter';
import ArticleView from './pages/ArticleView';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Disclaimer from './pages/Disclaimer';
import Dashboard from './pages/admin/Dashboard';
import EditArticle from './pages/admin/EditArticle';
import EditCourse from './pages/admin/EditCourse';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="academy" element={<Academy />} />
        <Route path="articles" element={<Articles />} />
        <Route path="blog" element={<Blog />} />
        <Route path="community" element={<Community />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseOverview />} />
        <Route path="courses/:courseId/lessons/:topicIdx/:subIdx" element={<LessonRouter />} />
        <Route path="exchange" element={<Exchange />} />
        <Route path="faqs" element={<Faqs />} />
        <Route path="beginner" element={<LearningTrack track="beginner" />} />
        <Route path="intermediate" element={<LearningTrack track="intermediate" />} />
        <Route path="advanced" element={<LearningTrack track="advanced" />} />
        <Route path="articles/:id" element={<ArticleView />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="disclaimer" element={<Disclaimer />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="admin/dashboard" element={<Dashboard />} />
        <Route path="admin/edit-article" element={<EditArticle />} />
        <Route path="admin/edit-article/:id" element={<EditArticle />} />
        <Route path="admin/edit-course" element={<EditCourse />} />
        <Route path="admin/edit-course/:id" element={<EditCourse />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
