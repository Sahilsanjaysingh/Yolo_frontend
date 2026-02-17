import LiveCamera from './LiveCamera';
import { motion } from 'framer-motion';

export default function Dashboard() {
  return (
    <section className="min-h-screen py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h2 className="text-4xl md:text-5xl font-bold font-serif mb-2">Live <span className="text-primary">Camera</span></h2>
          <p className="text-lg text-muted-foreground">Use your camera to run live detection via the YOLO endpoint.</p>
        </motion.div>

        <LiveCamera />
      </div>
    </section>
  );
}
