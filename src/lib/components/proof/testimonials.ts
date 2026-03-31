// proof/testimonials.ts — Client quote cards (3 quotes with name, role, text)
import type { SectionVariantFn } from "../types";

export const proofTestimonials: SectionVariantFn = (ctx) => {
  return `
        <section id="testimonials" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "客户评价" : "What Our Clients Say"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="bg-card rounded-2xl p-8 shadow-sm border border-border">
              <div className="flex items-center gap-1 mb-4 text-yellow-400">
                {"★★★★★"}
              </div>
              <p className="text-text/80 italic leading-relaxed mb-6">
                {lang === "zh"
                  ? "\"合作体验非常棒，交付质量超出预期。团队专业、沟通顺畅，强烈推荐！\""
                  : "\"Absolutely outstanding work. The quality exceeded our expectations and the communication was seamless throughout the project.\""}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">J</div>
                <div>
                  <p className="font-semibold text-sm">{lang === "zh" ? "张伟" : "James Wilson"}</p>
                  <p className="text-xs text-text/50">{lang === "zh" ? "CTO, 星辰科技" : "CTO, Stellar Tech"}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-sm border border-border">
              <div className="flex items-center gap-1 mb-4 text-yellow-400">
                {"★★★★★"}
              </div>
              <p className="text-text/80 italic leading-relaxed mb-6">
                {lang === "zh"
                  ? "\"从设计到上线只用了两周，效率惊人。产品上线后用户反馈非常好。\""
                  : "\"From concept to launch in just two weeks. The efficiency was remarkable and user feedback has been incredibly positive.\""}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">S</div>
                <div>
                  <p className="font-semibold text-sm">{lang === "zh" ? "李明" : "Sarah Chen"}</p>
                  <p className="text-xs text-text/50">{lang === "zh" ? "产品总监, 云帆网络" : "Product Director, CloudSail"}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-sm border border-border">
              <div className="flex items-center gap-1 mb-4 text-yellow-400">
                {"★★★★★"}
              </div>
              <p className="text-text/80 italic leading-relaxed mb-6">
                {lang === "zh"
                  ? "\"第三次合作了，每次都能带来新的惊喜。真正理解业务需求的技术伙伴。\""
                  : "\"Third project together and each time they bring something new to the table. A true technology partner who understands business needs.\""}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">M</div>
                <div>
                  <p className="font-semibold text-sm">{lang === "zh" ? "王芳" : "Michael Park"}</p>
                  <p className="text-xs text-text/50">{lang === "zh" ? "CEO, 锐思创投" : "CEO, RiseVentures"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>`;
};
