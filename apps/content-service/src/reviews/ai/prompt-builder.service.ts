import { Injectable } from '@nestjs/common';

export interface ReviewData {
  rating: number;
  body: string | null;
  isPublic: boolean;
}

export interface PeriodData {
  reviews: ReviewData[];
  total: number;
  avg: number;
}

@Injectable()
export class PromptBuilderService {
  buildAnalysisPrompt(
    period1: PeriodData,
    period2: PeriodData,
    totalChange: number,
    avgChange: number,
    dateRange: 'mtd' | 'ytd',
  ): string {
    const periodName = dateRange === 'mtd' ? 'month' : 'year';
    const period1Name = `Recent ${periodName} (Last ${dateRange === 'mtd' ? '30 days' : '365 days'})`;
    const period2Name = `Previous ${periodName} (${dateRange === 'mtd' ? '60-31 days ago' : '730-366 days ago'})`;

    const period1Reviews = this.formatReviews(period1.reviews);
    const period2Reviews = this.formatReviews(period2.reviews);

    return `
You are a professional medical feedback analyst. Analyze the following doctor reviews and provide insights in English.

## Statistical Summary:
- ${period1Name}: ${period1.total} reviews, average rating: ${period1.avg.toFixed(2)}/5
- ${period2Name}: ${period2.total} reviews, average rating: ${period2.avg.toFixed(2)}/5
- Change in review count: ${totalChange > 0 ? '+' : ''}${totalChange}
- Change in average rating: ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}

## ${period1Name} - Reviews:
${period1Reviews}

## ${period2Name} - Reviews:
${period2Reviews}

Please provide a comprehensive analysis in English with rich HTML formatting:

1. **Summary**: Brief overview of the doctor's review performance (2-3 sentences). Use <p> tags for paragraphs and <strong> for emphasis.

2. **Advantages**: Key strengths mentioned by patients. Format as HTML unordered list:
   - Use <ul> for the list container
   - Use <li> for each item (3-5 items)
   - Use <strong> to highlight key points within items

3. **Disadvantages**: Areas of concern or improvement. Format as HTML unordered list:
   - Use <ul> for the list container
   - Use <li> for each item (2-4 items)
   - Use <strong> to highlight key concerns within items

4. **Changes**: Notable changes between the two periods (2-3 sentences). Use <p> tags for paragraphs and <strong> for emphasis on important metrics.

5. **Recommendations**: Actionable recommendations for the doctor. Format as HTML unordered list:
   - Use <ul> for the list container
   - Use <li> for each item (3-5 items)
   - Use <strong> to highlight action items within items

IMPORTANT:
- Return content in English language
- All content must be properly formatted HTML
- Use semantic HTML tags: <p>, <strong>, <ul>, <li>
- Do NOT include wrapper <div> or <html> tags, only the content tags
- Each field should contain valid HTML that can be rendered directly
`;
  }

  private formatReviews(reviews: ReviewData[]): string {
    if (reviews.length === 0) {
      return 'No reviews in this period.';
    }

    return reviews
      .map((review, idx) => {
        const body = review.body || 'No written feedback';
        return `Review ${idx + 1}: Rating ${review.rating}/5\n${body}`;
      })
      .join('\n\n');
  }
}
